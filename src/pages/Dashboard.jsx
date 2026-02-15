import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, useRef } from 'react'; 
import { useOrderStore } from '../store/orders/useOrderStore';
import { useUnclaimedStore } from '../store/orders/useUnclaimedStore';

// FIXED IMPORT: Pointing to the actual utils folder
import { startDashboardTour } from '../utils/tour'; 

import CompactIntelligence from '../components/dashboard/CompactIntelligence';
import QuickActions from '../components/dashboard/QuickActions';
import QuickStats from '../components/dashboard/QuickStats';
import RecentActivity from '../components/dashboard/RecentActivity';
import TodayOrders from '../components/dashboard/TodayOrders';
import UnclaimedOrders from'../components/dashboard/UnclaimedOrders';
import { IconAlertTriangle, IconCheckCircle, IconClock, IconPackage, IconTrendingUp } from '../components/icons';
import { DashboardSkeleton } from '../components/skeleton-loader';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
};

const isSameDay = (d1, d2) => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

export default function Dashboard() {
  const { orders, isLoading, subscribeToOrders } = useOrderStore();
  const { unclaimedOrders } = useUnclaimedStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  const unclaimedRef = useRef(null);

  useEffect(() => {
    const unsubscribe = subscribeToOrders();
    return () => unsubscribe && unsubscribe();
  }, [subscribeToOrders]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const scrollToUnclaimed = () => {
    unclaimedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const now = new Date();
  const todayOrders = orders.filter(order => isSameDay(new Date(order.created_date), now));
  const todayRevenue = todayOrders
    .filter(order => order.is_paid)
    .reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);

  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const inProgress = orders.filter(o => o.status === 'in_progress').length;
  const readyOrders = orders.filter(o => o.status === 'ready').length;

  const hours = currentTime.getHours();
  const greeting = hours < 12 ? "Good morning" : hours < 18 ? "Good afternoon" : "Good evening";

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="min-h-screen bg-[#fdfeff] text-slate-900 p-2 transition-colors duration-500">
      <div className="max-w-6xl mx-auto px-1 md:px-2">
        <AnimatePresence mode="wait">
          <motion.div 
            key="dashboard-content"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {/* --- HEADER --- */}
            <motion.div variants={itemVariants} className="flex flex-row justify-between gap-6 items-start">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-800 capitalize">
                    {greeting}
                  </h1>
                  
                  <button 
                    onClick={startDashboardTour}
                    className="bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full text-[10px] font-bold text-indigo-500 hover:bg-indigo-100 transition-all shadow-sm active:scale-95"
                  >
                    ✨ HELP TOUR
                  </button>
                </div>
                <div>
                  <div className="flex items-center justify-between py-0.5 gap-2">
                    <p className="text-slate-500 text-[12px] font-medium ">
                      {currentTime.toLocaleDateString('en-US', { 
                        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
                      })}
                    </p>
                    <span className='opacity-30 text-slate-400 text-[13px]'> | </span>
                    <span className="text-slate-500 text-[12px] font-medium">
                      {currentTime.toLocaleTimeString([], { 
                        hour: '2-digit', minute: '2-digit', hour12: true 
                      }).toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <div id="step-actions" className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
                <QuickActions />
              </div>
            </motion.div>

            {/* --- INTELLIGENCE TICKER (Pastel Mint) --- */}
            <motion.div 
              variants={itemVariants} 
              id="step-intelligence" 
              className="flex flex-col md:flex-row items-center justify-between gap-4 bg-emerald-50/50 border border-emerald-100 p-1 rounded-2xl"
            >
              <div className="flex-1 w-full">
                <CompactIntelligence />
              </div>
              {unclaimedOrders.length > 0 && (
                <motion.button 
                  onClick={scrollToUnclaimed}
                  className="shrink-0 flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-xl transition-all group mr-1"
                >
                  <IconAlertTriangle className="w-4 h-4 text-rose-500" />
                  <span className="text-micro font-bold text-rose-600 ">
                    {unclaimedOrders.length} Overdue Pickups
                  </span>
                </motion.button>
              )}
            </motion.div>

            {/* --- QUICK STATS (Pastel Gradients) --- */}
            <motion.div variants={itemVariants} id="step-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <QuickStats title="Today's Sales" value={`₱${todayRevenue.toLocaleString()}`} icon={<IconTrendingUp />} bgColor="from-emerald-200 to-teal-300" trend={`${todayOrders.length} orders`} />
              <QuickStats title="Pending" value={pendingOrders} icon={<IconClock />} bgColor="from-amber-100 to-orange-200" trend="Needs attention" />
              <QuickStats title="In Progress" value={inProgress} icon={<IconPackage />} bgColor="from-sky-100 to-blue-200" trend="Being washed"/>
              <QuickStats title="Ready" value={readyOrders} icon={<IconCheckCircle />} bgColor="from-violet-100 to-purple-200" trend="Notify users"/>
            </motion.div>

            {/* --- DATA GRIDS --- */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
              <div className="lg:col-span-6 space-y-6">
                <motion.div variants={itemVariants} id="step-today-orders" className="bg-white rounded-3xl p-1 shadow-sm border border-slate-100">
                  <TodayOrders orders={todayOrders} isLoading={isLoading} />
                </motion.div>
                <motion.div ref={unclaimedRef} variants={itemVariants} id="step-unclaimed-orders" className="bg-white rounded-3xl p-1 shadow-sm border border-slate-100">
                  <UnclaimedOrders />
                </motion.div>
              </div>
              <motion.div variants={itemVariants} id="step-activity" className="lg:col-span-6 bg-slate-50/50 rounded-3xl p-1 border border-dashed border-slate-200">
                <RecentActivity />
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}