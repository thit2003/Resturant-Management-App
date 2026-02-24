import React, { useState } from 'react';
import { useApp } from '@/app/context/AppContext'
import { motion } from 'motion/react'
import { toast } from 'sonner'

export const CashierDashboard = () => {
  const { tables, orders, recordPayment, updateTableStatus } = useApp();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const getIsTableSeated = (tableId) =>
    orders.some((order) => order.tableId === tableId && !['paid', 'canceled'].includes(order.status));
  
  const handleTableSelect = (tableId) => {
    const order = [...orders]
      .reverse()
      .find((o) => o.tableId === tableId && !['paid', 'canceled'].includes(o.status));
    if (order) {
      setSelectedOrder(order);
      setPaymentMethod((order.paymentMethod || 'cash').toUpperCase());
    } else {
      toast.info("No active order for this table");
    }
  };

  const handlePayment = async () => {
    if (selectedOrder) {
      const success = await recordPayment(selectedOrder.id, paymentMethod);
      if (!success) return;
      updateTableStatus(selectedOrder.tableId, 'free');
      toast.success("Payment Confirmed");
      setSelectedOrder(null);
    }
  };

  if (selectedOrder) {
    const subtotal = toNumber(selectedOrder.subtotal ?? selectedOrder.total ?? 0);
    const tax = toNumber(selectedOrder.tax ?? 0);
    const total = toNumber(selectedOrder.total ?? subtotal + tax);

    return (
      <div className="w-full h-full flex flex-col items-center">
        <div className="w-full flex justify-between items-center mb-6">
           <div className="flex items-center gap-4">
             <div className="w-16 h-16 bg-[#FFD700] rounded-full flex items-center justify-center text-[#9F1E22] font-bold text-xl">
               T - {selectedOrder.tableId.replace('t-','')}
             </div>
             <h2 className="text-2xl font-bold text-white uppercase">Table- {selectedOrder.tableId.replace('t-','')}</h2>
           </div>
           <h1 className="text-4xl font-bold text-[#FFD700]">Payment</h1>
           <div className="w-20"></div> 
        </div>

        <div className="w-full max-w-4xl bg-white rounded-lg overflow-hidden shadow-2xl">
          <div className="bg-[#581C87] text-white p-4 font-bold text-xl px-8">
            Invoice
          </div>
          <div className="bg-[#8B5CF6] text-white grid grid-cols-12 p-3 px-8 font-semibold">
            <div className="col-span-1">No</div>
            <div className="col-span-5">Item</div>
            <div className="col-span-2 text-center">Quantity</div>
            <div className="col-span-2 text-right">Unit price</div>
            <div className="col-span-2 text-right">Total</div>
          </div>
          
          <div className="bg-white min-h-[300px]">
            {(selectedOrder.items ?? []).map((item, idx) => {
              const unitPrice = toNumber(item.price);
              const quantity = toNumber(item.quantity);
              return (
                <div key={idx} className="grid grid-cols-12 p-3 px-8 border-b border-gray-100 text-black font-medium text-lg">
                  <div className="col-span-1">{idx + 1}</div>
                  <div className="col-span-5">{item.name}</div>
                  <div className="col-span-2 text-center">{quantity}</div>
                  <div className="col-span-2 text-right">฿{unitPrice.toFixed(2)}</div>
                  <div className="col-span-2 text-right font-bold">฿{(unitPrice * quantity).toFixed(2)}</div>
                </div>
              );
            })}
          </div>

          <div className="bg-[#E9D5FF] grid grid-cols-12 p-3 px-8 font-bold text-black text-lg items-center">
             <div className="col-span-8"></div>
             <div className="col-span-2">Subtotal</div>
             <div className="col-span-2 text-right">฿{subtotal.toFixed(2)}</div>
          </div>
          <div className="bg-white grid grid-cols-12 p-3 px-8 text-black text-lg items-center border-t border-gray-100">
             <div className="col-span-8"></div>
             <div className="col-span-2">Tax rate</div>
             <div className="col-span-2 text-right">7%</div>
          </div>
           <div className="bg-white grid grid-cols-12 p-3 px-8 text-black text-lg items-center">
             <div className="col-span-8"></div>
             <div className="col-span-2">Tax</div>
             <div className="col-span-2 text-right">฿{tax.toFixed(2)}</div>
          </div>
          <div className="bg-[#581C87] text-white grid grid-cols-12 p-4 px-8 font-bold text-xl items-center">
             <div className="col-span-8"></div>
             <div className="col-span-2">Grand total</div>
             <div className="col-span-2 text-right">฿{total.toFixed(2)}</div>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-8 text-white font-bold text-lg">
          {['Cash', 'Card', 'QR'].map((method) => (
            <label key={method} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="payment-method"
                value={method}
                checked={paymentMethod === method}
                onChange={() => setPaymentMethod(method)}
                className="accent-[#FFD700]"
              />
              <span className="uppercase">{method}</span>
            </label>
          ))}
        </div>

        <button 
          onClick={handlePayment}
          className="mt-12 bg-[#FFD700] hover:bg-[#FCD34D] text-[#9F1E22] font-bold text-lg px-12 py-3 rounded-full shadow-lg transition-transform active:scale-95"
        >
          Confirm Payment
        </button>
      </div>
    );
  }

  // Table List View (Reused style from Staff)
  return (
    <div className="flex flex-col items-center max-w-2xl mx-auto w-full">
      <div className="w-full bg-[#87CEEB] text-black font-medium text-2xl py-6 rounded-full text-center shadow-lg mb-8">
        Table List
      </div>

      <div className="space-y-6 w-full">
        {tables.map(table => {
          const isSeated = getIsTableSeated(table.id);
          return (
            <motion.button
              key={table.id}
              onClick={() => handleTableSelect(table.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={
                `
                w-full py-6 px-12 rounded-full flex justify-between items-center text-2xl font-medium shadow-md transition-colors
                ${isSeated ? 'bg-[#FFF9C4] text-black ring-4 ring-[#FFD700]' : 'bg-[#C1F2C6] text-black'}
              `
              }
            >
              <span>Table {table.number}</span>
              <span className="capitalize">{isSeated ? 'Seated' : 'Free'}</span>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-12">
        <button className="bg-[#87CEEB] text-black font-medium text-xl py-4 px-16 rounded-full shadow-lg">
           Make Payment
        </button>
      </div>
    </div>
  );
};
