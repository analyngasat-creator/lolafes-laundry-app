import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CustomerForm } from "../components/orders/CustomerForm";
import { LoyaltyStatus } from "../components/orders/LoyaltyStatus";
import { OrderSummary } from "../components/orders/OrderSummary";
import { ServiceSelector } from "../components/orders/ServiceSelector";
import { db } from '../services/firebase';
import { useActivityStore } from "../store/activities/useActivityStore";
import { useCustomerStore } from "../store/customer/useCustomerStore";
import { useNewOrderStore } from "../store/new-order/useNewOrderStore";
import { useLoyaltyStore } from "../store/services/useLoyaltyStore";
import { useServiceStore } from "../store/services/useServiceStore";
import { useNotificationStore } from "../store/ui/useNotificationStore";

// IMPORT: The new process-based tour trigger
import { startNewOrderTour } from "../utils/tour"; 

import ClearCartModal from "../components/orders/ClearCartModal";
import { NewOrderSkeleton } from "../components/skeleton-loader";

// --- Helper Functions ---
const generateUniqueOrderNumber = async () => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const r = (source, len) => Array.from({ length: len }, () => source[Math.floor(Math.random() * source.length)]).join('');
  let isUnique = false;
  let newID = "";
  while (!isUnique) {
    newID = `ORD-${r(letters, 3)}${r(numbers, 3)}`;
    const q = query(collection(db, "orders"), where("order_number", "==", newID), limit(1));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) isUnique = true; 
  }
  return newID;
};

// --- UI Helper Components ---
const Button = ({ children, variant = "primary", size = "md", className = "", ...props }) => {
  const variants = {
    primary: "bg-blue-600 text-text-light hover:bg-blue-700 ",
    outline: "border border-gray-200 text-gray-700 hover:bg-gray-50",
    default: "bg-app-dark text-app-light",
    yellow: "bg-yellow-500 text-text-light hover:bg-yellow-600",
    ghost: "text-red-500 hover:bg-red-50"
  };
  const sizes = { sm: "px-3 py-1 text-xs", md: "px-4 py-2 text-sm", icon: "p-2" };
  return (
    <button 
      className={`rounded-lg font-medium transition-all flex items-center justify-center ${variants[variant]} ${sizes[size]} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};

const Input = ({ label, id, className = "", ...props }) => (
  <div className="w-full space-y-1">
    {label && (
      <label htmlFor={id} className="text-sm-text font-medium text-text-dark ml-1">
        {label}
      </label>
    )}
    <input 
      id={id} 
      className={`
        w-full h-11 px-4 rounded-xl border border-gray-300 transition-all 
        text-sm-text text-text-dark outline-none font-medium
        focus:border-app-dark/70 focus:ring-0
        placeholder:text-text-dark/40
        ${className}
      `} 
      {...props} 
    />
  </div>
);

const Badge = ({ children, className = "" }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${className}`}>{children}</span>
);

export default function NewOrder() {
  const location = useLocation();
  const navigate = useNavigate();

  // Stores
  const customers = useCustomerStore((state) => state.customers);
  const { loyaltySettings, subscribeToLoyalty } = useLoyaltyStore();
  const { submitOrder, createCustomer } = useNewOrderStore(); 
  const showNotification = useNotificationStore((state) => state.showNotification);
  const logActivity = useActivityStore((state) => state.logActivity);
  const { services, isLoading, subscribeToServices } = useServiceStore();

  const [shouldShowSkeleton, setShouldShowSkeleton] = useState(false);

  // States
  const [isProcessing, setIsProcessing] = useState(false);
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "" });
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [isPaid, setIsPaid] = useState(true); 

  // --- NEW: NEW ORDER TOUR TRIGGER ---
  useEffect(() => {
    const timer = setTimeout(() => {
        // Triggering the tour directly when they enter this page
        startNewOrderTour();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // --- VALIDATION & DUPLICATE LOGIC ---
  const isFormIncomplete = !customer.name.trim() || customer.phone.length < 11;
  
  const isPhoneDuplicate = customers.some(c => {
    const dbPhoneClean = String(c.phone || "").replace(/\D/g, "");
    const inputPhoneClean = String(customer.phone || "").replace(/\D/g, "");
    return dbPhoneClean === inputPhoneClean && c.id !== selectedCustomerId;
  });

  // --- CART PROTECTION LOGIC ---
  const [showClearWarning, setShowClearWarning] = useState(false);
  const prevCustomerRef = useRef(customer);

  useEffect(() => {
    const hasItems = selectedServices.length > 0;
    const nameChanged = prevCustomerRef.current.name !== customer.name && prevCustomerRef.current.name !== "";
    const phoneChanged = prevCustomerRef.current.phone !== customer.phone && prevCustomerRef.current.phone !== "";

    if (hasItems && (nameChanged || phoneChanged)) {
      setShowClearWarning(true);
    } else {
      prevCustomerRef.current = { ...customer };
    }
  }, [customer, selectedServices.length]);

  const handleConfirmClear = () => {
    setSelectedServices([]); 
    prevCustomerRef.current = customer; 
    setShowClearWarning(false);
  };

  const handleCancelClear = () => {
    setCustomer(prevCustomerRef.current); 
    setShowClearWarning(false);
  };

  // --- REWARD LOGIC ---
  const selectedCustomerData = selectedCustomerId ? customers.find(c => c.id === selectedCustomerId) : null;

  const handleApplyReward = () => {
    const hasReward = selectedServices.some(s => s.is_reward);
    if (hasReward || !loyaltySettings?.is_enabled) return;
    const currentData = selectedCustomerData || customer;
    const points = currentData.loyalty_points !== undefined ? currentData.loyalty_points : (currentData.order_count || 0);
    const required = loyaltySettings.orders_required || 10;
    if (Math.floor(points / required) <= 0) {
        showNotification("Insufficient points for reward.", "error");
        return;
    }
    const freeService = {
      id: `reward-${Date.now()}`, 
      service_name: `${loyaltySettings.free_service_type} (Reward)`,
      service_type: loyaltySettings.free_service_type,
      quantity: 1, price_per_kg: 0, subtotal: 0, is_reward: true 
    };
    setSelectedServices([...selectedServices, freeService]);
    showNotification("Reward applied!", "success");
  };

  useEffect(() => {
    let timer;
    if (isLoading) {
      timer = setTimeout(() => {
        setShouldShowSkeleton(true);
      }, 400);
    } else {
      setShouldShowSkeleton(false);
    }
    return () => clearTimeout(timer);
  }, [isLoading]);

  // --- SUBMIT LOGIC ---
  const handleSubmit = async () => {
    const isNameEmpty = !customer.name.trim();
    const isPhoneEmpty = !customer.phone.trim();
    const isPhoneInvalid = customer.phone.length < 11;
    const isCartEmpty = selectedServices.length === 0;

    if (isNameEmpty || isPhoneEmpty || isPhoneInvalid) {
      showNotification("Please complete Customer Name and a valid 11-digit Contact Number.", "error");
      return;
    }

    if (isCartEmpty) {
      showNotification("Please select at least one service to proceed.", "error");
      return;
    }
    
    if (isPhoneDuplicate) {
      showNotification("This phone number is already registered to another customer.", "error");
      return;
    }

    setIsProcessing(true);
    try {
      const uniqueOrderNumber = await generateUniqueOrderNumber();
      let finalCustomerId = selectedCustomerId;
      if (!finalCustomerId) {
        const newCust = await createCustomer({
          name: customer.name.trim(),
          phone: customer.phone.trim(),
          address: customer.address?.trim() || "",
        });
        finalCustomerId = newCust.id;
      }
      const totalAmount = selectedServices.reduce((sum, s) => sum + (Number(s.subtotal) || 0), 0);
      const pointsToDeduct = selectedServices.some(s => s.is_reward) ? (loyaltySettings.orders_required || 10) : 0;

      const orderPayload = {
        customer_id: finalCustomerId, 
        customer_name: customer.name.trim(),
        customer_phone: customer.phone.trim(),
        customer_address: customer.address?.trim() || "",
        order_number: uniqueOrderNumber, 
        total_amount: Number(totalAmount),
        notes: notes.trim(),
        payment_method: paymentMethod,
        is_paid: Boolean(isPaid),
        loyalty_points_to_deduct: pointsToDeduct,
        services: selectedServices.map(s => ({
          service_id: s.id, service_name: s.service_name, quantity: Number(s.quantity || 1),
          price_per_kg: Number(s.price_per_kg), subtotal: Number(s.subtotal), is_reward: Boolean(s.is_reward)
        }))
      };

      await submitOrder(orderPayload);
      logActivity(orderPayload, 'pending');

      showNotification(`Order ${uniqueOrderNumber} created!`, "success");
      navigate("/main/orders");

    } catch (err) {
      setIsProcessing(false);
      showNotification("Failed to save order.", "error");
    }
  };

  useEffect(() => {
    const unsubServices = subscribeToServices();
    const unsubLoyalty = subscribeToLoyalty();
    return () => { unsubServices(); unsubLoyalty(); };
  }, [subscribeToServices, subscribeToLoyalty]);

  useEffect(() => {
    const handleGlobalKeyPress = (e) => {
      if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") return;
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const nameInput = document.getElementById("customer-name");
        if (nameInput) {
          nameInput.focus();
          setCustomer(prev => ({ ...prev, name: (prev.name + e.key).toUpperCase() }));
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeyPress);
    return () => window.removeEventListener("keydown", handleGlobalKeyPress);
  }, []);

  if (isLoading && shouldShowSkeleton) {
    return <NewOrderSkeleton />;
  }
  
  if (isLoading && !shouldShowSkeleton) {
    return null;
  }

  return (
    <div className="min-h-screen bg-app-light p-2">
      <div className="max-w-6xl mx-auto px-1 md:px-2">
        <div className="flex justify-between items-center mb-3">
          <div className="flex flex-col">
            <h1 className="text-h2 text-text-dark">New Order</h1>
            <p className="text-sm-text text-gray-600 mt-0.5">Create a new laundry order</p>
          </div>
          {/* Helper button to manually restart tour if needed */}
          <Button variant="outline" size="sm" onClick={startNewOrderTour}>
             Help Tutorial
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 items-start">
          <div className="lg:col-span-2 space-y-4">
            {/* Step 1: Customer Details ID */}
            <div id="step-customer">
              <CustomerForm 
                customer={customer} setCustomer={setCustomer}
                selectedCustomerId={selectedCustomerId} setSelectedCustomerId={setSelectedCustomerId}
                allCustomers={[]} Button={Button} Input={Input}
                isSubmitting={isProcessing}
              />
            </div>
            
            {selectedCustomerData && (
              <div id="step-loyalty" className="animate-in fade-in slide-in-from-top-2 duration-300">
                <LoyaltyStatus 
                  customer={selectedCustomerData} 
                  loyaltySettings={loyaltySettings} 
                  Button={Button} Badge={Badge}
                  onApplyFreeService={handleApplyReward}
                  selectedServices={selectedServices} 
                />
              </div>
            )}
            
            {/* Step 2: Services & Weight ID */}
            <div id="step-services">
              <ServiceSelector 
                services={services} 
                selectedServices={selectedServices} 
                setSelectedServices={setSelectedServices} 
                Button={Button} 
                Badge={Badge}
                isCustomerIncomplete={isFormIncomplete} 
              />
            </div>
          </div>

          <div className="lg:col-span-1">
            {/* Step 3: Closing the Sale ID */}
            <div id="step-summary">
              <OrderSummary 
                customer={customer} 
                selectedServices={selectedServices}
                notes={notes} setNotes={setNotes}
                paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
                isPaid={isPaid} setIsPaid={setIsPaid}
                onSubmit={handleSubmit} isProcessing={isProcessing}
                Button={Button} Input={Input}
                isPhoneDuplicate={isPhoneDuplicate}
              />
            </div>
          </div>
        </div>
      </div>

      <ClearCartModal 
        isOpen={showClearWarning}
        onCancel={handleCancelClear}
        onConfirm={handleConfirmClear}
      />
    </div>
  );
}