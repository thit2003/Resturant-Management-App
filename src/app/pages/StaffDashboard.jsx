import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom"
import { useApp } from "@/app/context/AppContext"
import { motion } from "motion/react"
import { Search, ChevronDown, Plus, Minus, X, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

export const StaffDashboard = () => {
  const { tables, orders, menu, createOrder, updateOrderStatus } = useApp();
  const location = useLocation();

  const [selectedTableId, setSelectedTableId] = useState(null);
  const [viewMode, setViewMode] = useState("tables");

  // Sync with URL
  useEffect(() => {
    if (location.pathname.includes("/staff/menu")) {
      setViewMode("menu");
      // If no table selected, maybe default to first or just show menu for browsing?
      // For now, let's just keep previous logic or default to first free table if needed?
      // Actually, standard flow is Select Table -> Menu.
      // If clicking "Menu" from sidebar without table, maybe just show Menu in read-only or ask to select table?
      // I'll stick to 'tables' view if no table is selected, unless I want to allow generic menu browsing.
      if (!selectedTableId) {
        // Optionally toast "Select a table first" or similar
      }
    } else {
      if (viewMode !== "cart") setViewMode("tables");
    }
  }, [location.pathname]);

  // Menu Order State
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("All");
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const categoryRef = useRef(null);
  const [orderNote, setOrderNote] = useState("");
  const [proteinByItem, setProteinByItem] = useState({});

  const proteinOptions = [
    "None",
    "Beef",
    "Pork",
    "Chicken",
    "Seafood",
    "Vegetarian",
  ];
  const isDessertCategory = (category) =>
    String(category || "").toLowerCase().startsWith("dessert");

  const categories = useMemo(() => {
    const defaults = ["Main", "Appetizer", "Desserts", "Drinks"];
    const fromMenu = menu.map((item) => item.category).filter(Boolean);
    const unique = Array.from(new Set([...defaults, ...fromMenu]));
    return ["All", ...unique];
  }, [menu]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target)) {
        setIsCategoryOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedTable = tables.find(
    (t) => t.id === selectedTableId,
  );
  const tableOrders = orders.filter(
    (o) => o.tableId === selectedTableId,
  );

  const handleTableClick = (table) => {
    setSelectedTableId(table.id);
    setViewMode("menu");
  };

  const addToCart = (item) => {
    const protein = proteinByItem[item.id] || "None";
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.menuItemId === item.id && i.protein === protein,
      );
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === item.id && i.protein === protein
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          protein,
          quantity: 1,
        },
      ];
    });
    toast.success(`Added ${item.name}`);
  };

  const updateCartQuantity = (
    menuItemId,
    protein,
    delta,
  ) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.menuItemId === menuItemId && item.protein === protein) {
            return {
              ...item,
              quantity: item.quantity + delta,
            };
          }
          return item;
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const submitOrder = async () => {
    if (!selectedTableId || cart.length === 0) return;
    const created = await createOrder(selectedTableId, cart, orderNote);
    if (created) {
      setCart([]);
      setOrderNote("");
      setViewMode("tables");
      setSelectedTableId(null);
      toast.success("Order Placed Successfully");
    }
  };

  // CART VIEW
  if (viewMode === "cart" && selectedTable) {
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <div className="w-full max-w-4xl mx-auto mt-8 text-black">
        <h1 className="text-center text-[#FFD700] font-black text-5xl mb-12 drop-shadow-md">
          Cart Dashboard
        </h1>

        <div className="bg-white rounded-lg overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-[#6B21A8] text-white p-4 text-xl font-bold border-b border-white/20">
            Table: {selectedTable.number}
          </div>
          <div className="bg-[#6B21A8] text-white p-4 text-xl font-bold">
            Time: {time}
          </div>

          {/* Table Header */}
          <div className="bg-[#A855F7] text-white grid grid-cols-12 p-4 text-lg font-bold">
            <div className="col-span-1">No</div>
            <div className="col-span-6">Item</div>
            <div className="col-span-5">Quantity</div>
          </div>

          {/* Items */}
          <div className="bg-white min-h-[400px]">
            {cart.map((item, idx) => (
              <div
                key={`${item.menuItemId}-${item.protein}`}
                className="grid grid-cols-12 p-4 border-b border-gray-200 text-black text-xl items-center"
              >
                <div className="col-span-1">{idx + 1}</div>
                <div className="col-span-6 font-medium">
                  {item.name}
                  {item.protein && item.protein !== "None" && (
                    <span className="block text-sm text-gray-500">
                      {item.protein}
                    </span>
                  )}
                </div>
                <div className="col-span-5 flex items-center justify-between gap-4">
                   <div className="flex items-center gap-6">
                      <button
                        onClick={() =>
                          updateCartQuantity(item.menuItemId, item.protein, -1)
                        }
                        className="font-bold text-2xl hover:text-red-500 w-8"
                      >
                        -
                      </button>
                      <span className="font-bold w-8 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateCartQuantity(item.menuItemId, item.protein, 1)
                        }
                        className="font-bold text-2xl hover:text-green-500 w-8"
                      >
                        +
                      </button>
                   </div>
                   <button 
                     onClick={() => updateCartQuantity(item.menuItemId, item.protein, -item.quantity)}
                     className="bg-red-100 text-red-600 p-2 rounded-full hover:bg-red-200 transition-colors mr-4"
                     title="Remove Item"
                   >
                     <X size={20} />
                   </button>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="p-8 text-center text-gray-400 italic text-xl">
                Empty Cart
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 bg-white rounded-lg p-6 shadow-lg text-black">
          <label className="block text-lg font-bold text-[#9F1E22] mb-3">
            Special Instructions (avoid / add)
          </label>
          <textarea
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
            placeholder="e.g. No onions, extra spicy, peanut allergy"
            className="w-full h-24 rounded-lg border border-gray-200 p-4 text-lg focus:outline-none focus:ring-2 focus:ring-[#9F1E22]/40"
          />
        </div>

        {/* Footer Buttons */}
        <div className="mt-12 flex justify-between gap-8">
          <button
            onClick={submitOrder}
            className="flex-1 bg-[#FFD700] text-[#9F1E22] py-4 rounded-full font-bold text-xl shadow-lg hover:bg-[#FCD34D] transition-transform active:scale-95"
          >
            Confirm
          </button>
          <button
            onClick={() => setViewMode("menu")}
            className="flex-1 bg-[#FFD700] text-[#9F1E22] py-4 rounded-full font-bold text-xl shadow-lg hover:bg-[#FCD34D] transition-transform active:scale-95"
          >
            Add Item
          </button>
          <button
            onClick={() => setViewMode("menu")}
            className="flex-1 bg-[#FFD700] text-[#9F1E22] py-4 rounded-full font-bold text-xl shadow-lg hover:bg-[#FCD34D] transition-transform active:scale-95"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // TABLE ORDERS VIEW
  if (viewMode === "table-orders" && selectedTable) {
    return (
      <div className="w-full max-w-5xl mx-auto text-white">
        <div className="flex items-center gap-4 mb-10">
          <button
            onClick={() => setViewMode("tables")}
            className="bg-white/10 p-3 rounded-full hover:bg-white/20"
          >
            <ArrowLeft />
          </button>
          <h1 className="text-[#FFD700] font-black text-4xl">
            Table {selectedTable.number} Orders
          </h1>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden text-black">
          <div className="bg-[#6B21A8] text-white p-5 text-2xl font-bold">
            Order Management
          </div>
          <div className="grid grid-cols-12 bg-[#A855F7] text-white font-bold p-4 text-lg">
            <div className="col-span-4">Items</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3 text-right">Total</div>
            <div className="col-span-3 text-right">Action</div>
          </div>

          <div className="divide-y divide-gray-100">
            {tableOrders.length === 0 && (
              <div className="p-8 text-center text-gray-400 italic text-xl">
                No orders for this table
              </div>
            )}
            {tableOrders.map((order) => (
              <div key={order.id} className="grid grid-cols-12 p-4 items-center text-lg">
                <div className="col-span-4">
                  {order.items
                    .map((item) =>
                      `${item.quantity}x ${item.name}${item.protein && item.protein !== "None" ? ` (${item.protein})` : ""}`,
                    )
                    .join(", ")}
                </div>
                <div className="col-span-2 uppercase font-semibold">{order.status}</div>
                <div className="col-span-3 text-right font-bold">
                  ฿{Number(order.total).toFixed(2)}
                </div>
                <div className="col-span-3 text-right">
                  {order.status === "pending" ? (
                    <button
                      onClick={() => updateOrderStatus(order.id, "canceled")}
                      className="bg-red-100 text-red-600 px-4 py-2 rounded-full font-bold hover:bg-red-200"
                    >
                      Cancel
                    </button>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // MENU VIEW
  // Only show menu if a table is selected, otherwise prompt to select table
  if (viewMode === "menu") {
    if (!selectedTable) {
      // Fallback if accessed via direct link without state
      return (
        <div className="flex flex-col items-center justify-center h-full text-white">
          <h2 className="text-3xl font-bold mb-4">
            Please select a table first
          </h2>
          <button
            onClick={() => setViewMode("tables")}
            className="bg-[#FFD700] text-[#9F1E22] px-8 py-3 rounded-full font-bold"
          >
            Back to Tables
          </button>
        </div>
      );
    }

    return (
      <div className="text-white">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => setViewMode("tables")}
            className="bg-white/10 p-3 rounded-full hover:bg-white/20"
          >
            <ArrowLeft />
          </button>
          <div className="w-16 h-16 bg-[#FFD700] rounded-full flex items-center justify-center text-[#9F1E22] font-black text-xl shadow-lg border-4 border-white/20">
            T-{selectedTable.number}
          </div>
          <h1 className="text-3xl font-bold uppercase">
            Table - {selectedTable.number}
          </h1>

          <div className="flex-1 mx-8 relative">
            <input
              placeholder="Search Menu"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F2E8DC] text-black px-6 py-3 rounded-full pl-12 focus:outline-none"
            />
            <Search
              className="absolute left-4 top-3.5 text-gray-400"
              size={20}
            />
          </div>

          <div ref={categoryRef} className="relative z-20">
            <button
              onClick={() => setIsCategoryOpen((prev) => !prev)}
              className="flex items-center gap-2 text-[#FFD700] font-bold text-xl uppercase"
            >
              {selectedCategory === "All"
                ? "Category"
                : selectedCategory}{" "}
              <ChevronDown />
            </button>
            {isCategoryOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-[#F2E8DC] rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                    setIsCategoryOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 text-[#9F1E22] font-bold hover:bg-[#FFD700] transition-colors"
                >
                  {cat}
                </button>
              ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-32">
          {menu
            .filter(
              (item) =>
                selectedCategory === "All" ||
                item.category === selectedCategory,
            )
            .filter((item) =>
              item.name
                .toLowerCase()
                .includes(searchQuery.toLowerCase()),
            )
            .map((item, idx) => (
              <div
                key={item.id}
                className="bg-transparent flex flex-col group"
              >
                <div className="relative aspect-square mb-4">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover rounded-2xl shadow-lg border-4 border-white/10 group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-start">
                    <h3 className="text-2xl font-bold text-white leading-tight">
                      0{idx + 1} {item.name}
                    </h3>
                  </div>
                  <p className="text-white/80 text-lg mb-2">
                    {item.price} bahts
                  </p>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center text-white gap-3 font-bold text-xl">
                      <button
                        onClick={() =>
                          updateCartQuantity(
                            item.id,
                            proteinByItem[item.id] || "None",
                            1,
                          )
                        }
                        className="hover:text-[#FFD700]"
                      >
                        +
                      </button>
                      <span>
                        {cart
                          .filter((c) => c.menuItemId === item.id)
                          .reduce((sum, c) => sum + c.quantity, 0)}
                      </span>
                      <button
                        onClick={() =>
                          updateCartQuantity(
                            item.id,
                            proteinByItem[item.id] || "None",
                            -1,
                          )
                        }
                        className="hover:text-[#FFD700]"
                      >
                        -
                      </button>
                    </div>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex flex-col gap-1">
                        <select
                          value={proteinByItem[item.id] || "None"}
                          onChange={(e) =>
                            setProteinByItem((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          disabled={isDessertCategory(item.category)}
                          className="bg-white/90 text-black text-sm font-bold rounded-full px-3 py-2 border border-white/40 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {proteinOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => addToCart(item)}
                        className="flex-1 bg-[#FFD700] hover:bg-[#FCD34D] text-black font-bold py-2 rounded-full shadow-lg active:scale-95 transition-all uppercase text-sm"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>

        {/* Cart Floater */}
        {cart.length > 0 && (
          <div className="fixed bottom-8 right-8 left-24 md:left-64 flex justify-end px-8 pointer-events-none z-30">
            <button
              onClick={() => setViewMode("cart")}
              className="pointer-events-auto bg-[#FFD700] text-black font-black text-xl px-12 py-4 rounded-full shadow-2xl hover:bg-[#FCD34D] transition-transform hover:scale-105 flex items-center gap-3 border-4 border-[#9F1E22]"
            >
              Go to Cart (
              {cart.reduce((a, b) => a + b.quantity, 0)})
            </button>
          </div>
        )}
      </div>
    );
  }

  // TABLES LIST VIEW
  return (
    <div className="flex flex-col items-center max-w-2xl mx-auto w-full">
      <div className="w-full bg-[#87CEEB] text-black font-medium text-2xl py-6 rounded-full text-center shadow-lg mb-8 relative">
        Table List
      </div>

      <div className="space-y-6 w-full">
        {tables.map((table) => (
          <motion.div
            key={table.id}
            onClick={() => handleTableClick(table)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleTableClick(table);
              }
            }}
            role="button"
            tabIndex={0}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
              w-full py-6 px-12 rounded-full flex justify-between items-center text-2xl font-medium shadow-md transition-colors
              ${table.status === "free" ? "bg-[#C1F2C6] text-black" : "bg-[#FFF9C4] text-black"}
            `}
          >
            <span>Table {table.number}</span>
            <span className="flex items-center gap-6">
              <span className="text-sm text-black/60">
                Capacity: {table.seats}
              </span>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedTableId(table.id);
                  setViewMode("table-orders");
                }}
                className="bg-white/70 hover:bg-white text-[#9F1E22] font-bold text-sm px-4 py-2 rounded-full shadow-sm border border-[#9F1E22]/20"
              >
                Order Management
              </button>
            </span>
          </motion.div>
        ))}
      </div>

      <div className="w-full mt-12 bg-white rounded-2xl shadow-lg overflow-hidden text-black">
        <div className="bg-[#6B21A8] text-white p-4 text-xl font-bold">
          Active Orders
        </div>
        <div className="divide-y divide-gray-100">
          {orders.length === 0 && (
            <div className="p-6 text-center text-gray-400 italic">
              No orders yet
            </div>
          )}
          {orders.map((order) => (
            <div key={order.id} className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold">Table {order.tableId.replace("t-", "")}</div>
                  <div className="text-sm text-gray-500 uppercase">{order.status}</div>
                </div>
                {order.status === "pending" ? (
                  <button
                    onClick={() => updateOrderStatus(order.id, "canceled")}
                    className="bg-red-100 text-red-600 px-4 py-2 rounded-full font-bold hover:bg-red-200"
                  >
                    Cancel
                  </button>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </div>
              <div className="text-sm text-gray-700">
                {order.items
                  .map((item) =>
                    `${item.quantity}x ${item.name}${item.protein && item.protein !== "None" ? ` (${item.protein})` : ""}`,
                  )
                  .join(", ")}
              </div>
              <div className="text-sm font-bold text-[#9F1E22]">
                Total: ฿{order.total.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
