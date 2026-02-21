import React, { useState } from 'react';
import { useApp } from '@/app/context/AppContext'
import { motion, AnimatePresence } from 'motion/react'
import { Printer } from 'lucide-react'

export const ChefDashboard = () => {
  const { orders, updateOrderStatus } = useApp();
  const [activeTab, setActiveTab] = useState('all');

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const processingOrders = orders.filter(o => o.status === 'processing');
  const finishOrders = orders.filter(o => o.status === 'finish' || o.status === 'completed');

  let displayedOrders = [];
  // "All" shows only new orders (pending). Start -> Processing, Finish -> Finish tab.
  if (activeTab === 'all') displayedOrders = pendingOrders;
  else if (activeTab === 'processing') displayedOrders = processingOrders;
  else displayedOrders = finishOrders;

  // The design shows specific yellow header cards.
  // "Processing" tab active state is a Red Pill.
  // "Finish" tab is also an option.

  return (
    <div className="h-full">
      {/* Top Tabs */}
      <div className="flex justify-center mb-12">
        <div className="bg-[#F2E8DC] p-2 rounded-full flex w-full max-w-3xl justify-between items-center px-4 shadow-lg">
           {['All', 'Processing', 'Finish'].map((tab) => {
             const tabKey = tab.toLowerCase();
             const isActive = activeTab === tabKey;
             return (
               <button
                 key={tab}
                 onClick={() => setActiveTab(tabKey)}
                 className={`
                    px-12 py-3 rounded-full font-bold text-lg transition-all
                    ${isActive ? 'bg-[#9F1E22] text-white shadow-md' : 'text-[#9F1E22] hover:bg-white/50'}
                 `}
               >
                 {tab}
               </button>
             );
           })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
        <AnimatePresence>
          {displayedOrders.map((order) => (
             <OrderCard 
               key={order.id} 
               order={order} 
               onAction={() => {
                 if (order.status === 'pending') updateOrderStatus(order.id, 'processing');
                 else if (order.status === 'processing') updateOrderStatus(order.id, 'finish');
                 else if (order.status === 'finish') updateOrderStatus(order.id, 'completed');
               }}
             />
          ))}
        </AnimatePresence>
        {displayedOrders.length === 0 && (
           <div className="col-span-full text-center text-white/50 italic text-2xl mt-20">
             No orders in {activeTab}
           </div>
        )}
      </div>
    </div>
  );
};

const OrderCard = ({ order, onAction }) => {
  const isFinished = order.status === 'finish' || order.status === 'completed';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      layout
      className="bg-white rounded-3xl overflow-hidden shadow-xl flex flex-col h-[500px]"
    >
      {/* Header */}
      <div className="bg-[#FFD700] p-6 relative">
         <div className="flex justify-between items-start text-[#9F1E22]">
           <div>
             <h3 className="font-bold text-2xl">Table {order.tableId.replace('t-', '')}</h3>
             <p className="font-medium text-lg opacity-80">Order #{order.id.slice(0,4)}</p>
             <p className="font-medium text-lg opacity-80">
               {new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
             </p>
           </div>
           <Printer className="w-8 h-8 opacity-80" />
         </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-6 overflow-y-auto">
        {order.items.map((item, idx) => (
          <div key={idx} className="flex gap-4 mb-4 text-[#9F1E22] text-2xl font-medium">
             <span className="font-bold w-8">{item.quantity}x</span>
             <span>{item.name}</span>
             {item.protein && item.protein !== "None" && (
               <span className="text-base text-[#9F1E22]/70">({item.protein})</span>
             )}
          </div>
        ))}
        {order.note && (
          <div className="mt-6 rounded-xl border border-[#9F1E22]/20 bg-[#FFF7E0] p-4 text-[#9F1E22]">
            <div className="font-bold mb-1">Special Instructions</div>
            <div className="text-base">{order.note}</div>
          </div>
        )}
      </div>

      {/* Footer Button */}
      <div className="p-6 pt-0">
        <button
          onClick={onAction}
          className={`
            w-full py-4 rounded-full text-white font-bold text-xl uppercase tracking-wider shadow-lg transition-transform active:scale-95
            ${isFinished ? 'bg-[#9F1E22] hover:bg-[#7F181B]' : 'bg-[#9F1E22] hover:bg-[#7F181B]'}
          `}
        >
          {order.status === 'pending' ? 'Start' : order.status === 'processing' ? 'Finish' : 'Completed'}
        </button>
      </div>
    </motion.div>
  );
};
