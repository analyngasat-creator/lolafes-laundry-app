import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// Helper to erase highlights after clicking "Done"
const clearTourStyles = (element) => {
  if (element) {
    element.style.outline = "";
    element.style.outlineOffset = "";
    element.style.boxShadow = "";
  }
};

const tourConfig = {
  showProgress: true,
  animate: true,
  overlayColor: 'rgba(0, 15, 45, 0.85)',
  stagePadding: 8,
  onHighlightStarted: (element) => {
    if (element) {
      element.style.outline = "4px solid #0056fb"; // GCash-style Blue highlight
      element.style.outlineOffset = "4px";
      element.style.borderRadius = "12px";
    }
  },
  onDeselected: (element) => clearTourStyles(element),
  onDestroyStarted: (element) => {
    clearTourStyles(element);
    document.querySelectorAll('[style*="outline"]').forEach(el => clearTourStyles(el));
  }
};

// EXPORTS: These fix the compilation errors in your terminal
export const startNewOrderTour = () => {
  const driverObj = driver({
    ...tourConfig,
    steps: [
      { element: '#field-name', popover: { title: '👤 New Order', description: 'Start by entering the customer name.', side: "bottom" } }
    ]
  });
  driverObj.drive();
};

export const startOrderPageTour = () => {
  const driverObj = driver({
    ...tourConfig,
    steps: [
      { element: '#order-title-step', popover: { title: '📋 Orders Hub', description: 'Manage and track all laundry jobs.', side: "bottom" } }
    ]
  });
  driverObj.drive();
};