import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  PieChart,
  Pie,
  Cell,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/app/components/ui/chart'
import { useApp } from '@/app/context/AppContext'

const API_ROOT = String(import.meta.env.VITE_API_BASE_URL || '/api').replace(
  /\/+$/,
  '',
);
const API_BASE = API_ROOT.endsWith('/api') ? API_ROOT : `${API_ROOT}/api`;
const apiUrl = (path) => `${API_BASE}/${String(path || '').replace(/^\/+/, '')}`;
const getTableRouteId = (id) => String(id || '').replace(/^t-/i, '');
const normalizeEntityId = (id) => {
  const numeric = Number(id);
  return Number.isFinite(numeric) ? numeric : String(id ?? '');
};

const readErrorMessage = async (res, fallback) => {
  const contentType = String(res.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    const payload = await res.json().catch(() => ({}));
    return payload?.error || `${fallback} (HTTP ${res.status})`;
  }
  if (contentType.includes('text/html')) {
    return `${fallback} (HTTP ${res.status}). Backend returned an HTML error page; check backend server logs.`;
  }
  const rawText = await res.text().catch(() => '');
  const text = rawText.trim();
  if (text) return `${fallback} (HTTP ${res.status}): ${text.slice(0, 180)}`;
  return `${fallback} (HTTP ${res.status})`;
};

const normalizeStaffMember = (person) => ({
  id: person?.id ?? person?.user_id ?? null,
  name: person?.name || '',
  email: person?.email || '',
  role: String(person?.role || 'staff').toLowerCase(),
  salary: Number(person?.salary || 0),
  date_of_birth: person?.date_of_birth ?? person?.dob ?? null,
  photo: person?.photo || null,
});

const getPreviousMonthValue = () => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getCurrentMonthValue = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const isFutureMonthValue = (monthValue) => {
  const [yearRaw, monthRaw] = String(monthValue || '').split('-');
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return false;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return year > currentYear || (year === currentYear && month > currentMonth);
};

const shiftMonthValue = (monthValue, monthDelta) => {
  const [yearRaw, monthRaw] = String(monthValue || '').split('-');
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return monthValue;
  }
  const date = new Date(year, month - 1, 1);
  date.setMonth(date.getMonth() + monthDelta);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  return `${nextYear}-${nextMonth}`;
};

const formatMonthValue = (monthValue) => {
  const [yearRaw, monthRaw] = String(monthValue || '').split('-');
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return '';
  }
  return new Date(year, month - 1, 1).toLocaleDateString([], {
    month: 'long',
    year: 'numeric',
  });
};

const getMonthParts = (monthValue) => {
  const [yearRaw, monthRaw] = String(monthValue || '').split('-');
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
};

const buildMonthValue = (year, month) => {
  const normalizedYear = Number.parseInt(String(year), 10);
  const normalizedMonth = Number.parseInt(String(month), 10);
  if (!Number.isInteger(normalizedYear) || !Number.isInteger(normalizedMonth)) return '';
  if (normalizedMonth < 1 || normalizedMonth > 12) return '';
  return `${normalizedYear}-${String(normalizedMonth).padStart(2, '0')}`;
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// --- Main Component ---
export const ManagerDashboard = () => {
  const { analytics, orders, menu: appMenu, tables: appTables, staff: appStaff } = useApp();
  const location = useLocation();
  const [menuItems, setMenuItems] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [tableList, setTableList] = useState([]);
  const [ordersFromDb, setOrdersFromDb] = useState([]);
  const [isMenuLoading, setIsMenuLoading] = useState(false);
  const [isStaffLoading, setIsStaffLoading] = useState(false);
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [hasLoadedStaff, setHasLoadedStaff] = useState(false);
  const [staffLoadError, setStaffLoadError] = useState('');
  
  const getActiveView = () => {
    const path = location.pathname;
    if (path.includes('/menu')) return 'menu';
    if (path.includes('/staff')) return 'staff';
    if (path.includes('/tables')) return 'tables';
    if (path.includes('/reports')) return 'report';
    return 'dashboard';
  };

  const view = getActiveView();
  const effectiveMenuItems = menuItems.length > 0 ? menuItems : appMenu;
  const effectiveTableList = tableList.length > 0 ? tableList : appTables;
  const effectiveStaffList = staffList.length > 0 ? staffList : appStaff;
  const effectiveOrders = orders.length > 0 ? orders : ordersFromDb;

  const fetchMenu = async () => {
    setIsMenuLoading(true);
    try {
      const res = await fetch(apiUrl('menu'), { cache: 'no-store' });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to load menu items'));
      const data = await res.json();
      setMenuItems(
        (Array.isArray(data) ? data : []).map((item) => ({
          ...item,
          menuItemId: Number(item?.menuItemId ?? item?.id ?? 0),
          price: Number(item?.price || 0),
        })),
      );
    } catch (error) {
      toast.error(error?.message || 'Failed to load menu items');
    } finally {
      setIsMenuLoading(false);
    }
  };

  const fetchStaff = async () => {
    setIsStaffLoading(true);
    setStaffLoadError('');
    try {
      const res = await fetch(apiUrl('staff'));
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to load staff'));
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      setStaffList(rows.map(normalizeStaffMember).filter((person) => person.id !== null));
      setHasLoadedStaff(true);
    } catch (error) {
      const message = error?.message || 'Failed to load staff';
      setStaffLoadError(message);
      toast.error(message);
    } finally {
      setIsStaffLoading(false);
    }
  };

  const fetchTables = async () => {
    setIsTableLoading(true);
    try {
      const res = await fetch(apiUrl('tables'));
      if (!res.ok) throw new Error('Failed to load tables');
      const data = await res.json();
      setTableList(data);
    } catch (error) {
      if ((tableList?.length || 0) === 0 && (appTables?.length || 0) === 0) {
        toast.error('Failed to load tables');
      }
    } finally {
      setIsTableLoading(false);
    }
  };

  const fetchOrdersForManager = async () => {
    try {
      const res = await fetch(apiUrl('orders'), { cache: 'no-store' });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to load orders'));
      const data = await res.json();
      setOrdersFromDb(Array.isArray(data) ? data : []);
    } catch (error) {
      // Keep silent here to avoid noisy toasts; reports/tables can still use context orders.
    }
  };

  useEffect(() => {
    fetchMenu();
    fetchStaff();
    fetchTables();
    fetchOrdersForManager();
  }, []);

  useEffect(() => {
    if (view === 'menu') fetchMenu();
    if (view === 'staff') fetchStaff();
    if (view === 'tables') fetchTables();
    if (view === 'tables' || view === 'report') fetchOrdersForManager();
  }, [view]);

  const addMenuItem = async (item) => {
    try {
      const res = await fetch(apiUrl('menu'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to create menu item'));
      await res.json();
      await fetchMenu();
      toast.success('Menu item added');
    } catch (error) {
      toast.error(error.message || 'Failed to add menu item');
    }
  };

  const updateMenuItem = async (id, updates) => {
    try {
      const res = await fetch(apiUrl(`menu/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to update menu item'));
      await res.json();
      await fetchMenu();
      toast.success('Menu item updated');
    } catch (error) {
      toast.error(error.message || 'Failed to update menu item');
    }
  };

  const deleteMenuItem = async (id) => {
    try {
      const res = await fetch(apiUrl(`menu/${id}`), { method: 'DELETE' });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to delete menu item'));
      await fetchMenu();
      toast.success('Menu item deleted');
    } catch (error) {
      toast.error(error.message || 'Failed to delete menu item');
    }
  };

  const addStaff = async (staff) => {
    try {
      const res = await fetch(apiUrl('staff'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staff),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to create staff'));
      const created = normalizeStaffMember(await res.json());
      setStaffList((prev) => [...prev, created]);
      toast.success('Staff member added');
    } catch (error) {
      toast.error(error.message || 'Failed to add staff');
    }
  };

  const updateStaff = async (id, updates) => {
    try {
      const res = await fetch(apiUrl(`staff/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to update staff'));
      const updated = normalizeStaffMember(await res.json());
      setStaffList((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updated } : item)),
      );
      toast.success('Staff updated');
    } catch (error) {
      toast.error(error.message || 'Failed to update staff');
    }
  };

  const deleteStaff = async (id) => {
    try {
      const res = await fetch(apiUrl(`staff/${id}`), { method: 'DELETE' });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to delete staff'));
      const targetId = normalizeEntityId(id);
      setStaffList((prev) => prev.filter((item) => normalizeEntityId(item?.id) !== targetId));
      toast.success('Staff removed');
    } catch (error) {
      toast.error(error.message || 'Failed to delete staff');
    }
  };

  const addTable = async (table) => {
    try {
      const res = await fetch(apiUrl('tables'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(table),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to create table'));
      await res.json();
      await fetchTables();
      toast.success('Table added');
    } catch (error) {
      toast.error(error.message || 'Failed to add table');
    }
  };

  const updateTable = async (id, updates) => {
    try {
      const routeId = getTableRouteId(id);
      const res = await fetch(apiUrl(`tables/${routeId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to update table'));
      await res.json();
      await fetchTables();
      toast.success('Table updated');
    } catch (error) {
      toast.error(error.message || 'Failed to update table');
    }
  };

  const deleteTable = async (id) => {
    try {
      const routeId = getTableRouteId(id);
      const res = await fetch(apiUrl(`tables/${routeId}`), { method: 'DELETE' });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to delete table'));
      await fetchTables();
      toast.success('Table removed');
    } catch (error) {
      toast.error(error.message || 'Failed to delete table');
    }
  };

  return (
    <div className="w-full h-full text-[#9F1E22]">
       <AnimatePresence mode="wait">
         <motion.div 
           key={view}
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, y: -10 }}
           className="h-full"
         >
            {view === 'dashboard' && <DashboardHome analytics={analytics} />}
            {view === 'menu' && (
              <MenuManager
                menu={effectiveMenuItems}
                isLoading={isMenuLoading}
                onDelete={deleteMenuItem}
                onAdd={addMenuItem}
                onUpdate={updateMenuItem}
                onRefresh={fetchMenu}
              />
            )}
            {view === 'staff' && (
              <StaffManager
                staff={effectiveStaffList}
                isLoading={isStaffLoading}
                hasLoadedStaff={hasLoadedStaff}
                staffLoadError={staffLoadError}
                onAdd={addStaff}
                onUpdate={updateStaff}
                onDelete={deleteStaff}
                onRefresh={fetchStaff}
              />
            )}
            {view === 'tables' && (
              <TableManager
                tables={effectiveTableList}
                orders={effectiveOrders}
                isLoading={isTableLoading}
                onAdd={addTable}
                onUpdate={updateTable}
                onDelete={deleteTable}
                onRefresh={fetchTables}
              />
            )}
            {view === 'report' && <Reports analytics={analytics} orders={effectiveOrders} />}
         </motion.div>
       </AnimatePresence>
    </div>
  );
};

// --- Sub-Components ---

// 1. Dashboard Home
const DashboardHome = ({ analytics }) => {
  const paymentTotal = analytics.paymentBreakdown.reduce((sum, item) => sum + item.count, 0);
  const peakHours = analytics.hourlyOrders
    .filter((item) => item.orders > 0)
    .slice(0, 12);
  const topItems = analytics.topItems;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* KPI Cards */}
      <div className="bg-[#F2E8DC] p-8 rounded-3xl flex flex-col justify-center items-center text-center shadow-lg min-h-[220px]">
        <h2 className="text-[#9F1E22] font-black text-3xl mb-4 uppercase tracking-widest">Today's Sales</h2>
        <span className="text-5xl font-bold text-[#9F1E22]">฿ {analytics.todaySales.toFixed(2)}</span>
      </div>
      
      <div className="bg-[#F2E8DC] p-8 rounded-3xl flex flex-col justify-center items-center text-center shadow-lg min-h-[220px]">
        <h2 className="text-[#9F1E22] font-black text-3xl mb-4 uppercase tracking-widest">Total Order</h2>
        <span className="text-5xl font-bold text-[#9F1E22]">{analytics.totalOrders}</span>
      </div>

      <div className="bg-[#F2E8DC] p-8 rounded-3xl shadow-lg min-h-[320px]">
        <h2 className="text-[#9F1E22] font-black text-2xl mb-4 uppercase tracking-wide">Peak Traffic (Orders/Hour)</h2>
        <ChartContainer
          className="h-[240px] w-full"
          config={{ orders: { label: 'Orders', color: '#9F1E22' } }}
        >
          <BarChart data={peakHours}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={1} />
            <YAxis allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="orders" fill="var(--color-orders)" radius={6} />
          </BarChart>
        </ChartContainer>
      </div>

      <div className="bg-[#F2E8DC] p-8 rounded-3xl shadow-lg min-h-[320px]">
        <h2 className="text-[#9F1E22] font-black text-2xl mb-4 uppercase tracking-wide">Payment Method Split</h2>
        <ChartContainer
          className="h-[240px] w-full"
          config={{
            count: { label: 'Transactions' },
            CASH: { label: 'Cash', color: '#10B981' },
            CARD: { label: 'Card', color: '#3B82F6' },
            QR: { label: 'QR', color: '#F59E0B' },
          }}
        >
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => `${value} tx`} />}
            />
            <Pie
              data={analytics.paymentBreakdown}
              dataKey="count"
              nameKey="method"
              innerRadius={45}
              outerRadius={85}
            >
              {analytics.paymentBreakdown.map((entry) => (
                <Cell
                  key={entry.method}
                  fill={entry.method === 'CASH' ? '#10B981' : entry.method === 'CARD' ? '#3B82F6' : '#F59E0B'}
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="mt-2 text-sm font-semibold text-[#9F1E22]/80">
          Total transactions: {paymentTotal}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold text-[#9F1E22]/80">
          {analytics.paymentBreakdown.map((item) => (
            <div key={item.method} className="bg-white rounded-lg px-3 py-2">
              <div>{item.method}</div>
              <div>{item.count} tx</div>
              <div>฿{item.revenue.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#F2E8DC] p-8 rounded-3xl shadow-lg md:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-[#9F1E22] font-black text-2xl uppercase tracking-wide">Top 5 Best Sellers</h2>
          <div className="text-[#9F1E22] font-bold">
            AOV per Table: ฿ {analytics.averageOrderValue.toFixed(2)}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {topItems.map((item, idx) => (
            <div key={item.name} className="bg-white rounded-xl p-4 border border-[#9F1E22]/10">
              <div className="text-xs font-black text-[#9F1E22]/60">#{idx + 1}</div>
              <div className="font-bold text-[#9F1E22] mt-2 line-clamp-2 min-h-[44px]">{item.name}</div>
              <div className="text-xl font-black text-[#9F1E22] mt-3">{item.quantity}</div>
              <div className="text-xs text-[#9F1E22]/70 uppercase">orders qty</div>
            </div>
          ))}
          {topItems.length === 0 && (
            <div className="text-[#9F1E22]/70 italic">No order data yet.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// 2. Menu Manager
const MenuManager = ({ menu, isLoading, onDelete, onAdd, onUpdate, onRefresh }) => {
  const [editingItem, setEditingItem] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const categories = Array.from(
    new Set(
      menu
        .map((item) => String(item?.category || '').trim())
        .filter(Boolean),
    ),
  );

  if (editingItem || isAdding) {
     return (
       <MenuEditor 
         item={editingItem} 
         categories={categories}
         onDelete={onDelete}
         onClose={() => { setEditingItem(null); setIsAdding(false); }} 
         onSave={(newItem) => { 
            if (isAdding) {
              onAdd(newItem);
            } else if (editingItem) {
              onUpdate(editingItem.id ?? editingItem.menuItemId, newItem);
            }
            setEditingItem(null);
            setIsAdding(false);
         }}
       />
     );
  }

  return (
    <div className="bg-[#F2E8DC] rounded-3xl shadow-xl p-8 md:p-10 min-h-[80vh] flex flex-col">
      <div className="text-5xl font-black mb-8 text-[#9F1E22]">Menu</div>
      {isLoading && (
        <div className="text-lg font-semibold text-[#9F1E22] mb-6">Loading menu...</div>
      )}
      {!isLoading && menu.length === 0 && (
        <div className="text-lg font-semibold text-[#9F1E22] mb-6">
          No menu record found in database.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-10 md:gap-x-14 flex-1">
        {menu.map((item, idx) => (
          <div
            key={item.id}
            className={`flex items-center gap-5 ${idx % 2 === 0 ? 'md:border-r-2 md:border-black/25 md:pr-10' : 'md:pl-4'}`}
          >
             <div className="w-36 h-36 bg-white overflow-hidden shadow-md border border-black/5">
                <img
                  src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'}
                  className="w-full h-full object-cover"
                  alt={item.name}
                />
             </div>
             <div className="flex-1 min-w-0">
                <div className="text-[2rem] font-black text-black leading-tight">
                  {`${String(item.menuItemId || item.id || idx + 1).padStart(2, '0')} `}
                  <span className="text-[#9F1E22] break-words">{item.name}</span>
                </div>
                <div className="text-xl text-[#9F1E22]/85 font-semibold mt-1">
                  {Number(item.price || 0)} bahts
                </div>
                <button
                  onClick={() => setEditingItem(item)}
                  className="mt-6 bg-[#FFD700] hover:bg-[#FCD34D] text-black font-bold text-xl py-2.5 px-16 rounded-full shadow-md transition-transform active:scale-95"
                >
                  Edit
                </button>
             </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center mt-10">
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-[#FFD700] hover:bg-[#FCD34D] text-black font-bold text-2xl py-3 px-28 rounded-full shadow-xl transition-transform active:scale-95"
        >
          Add more
        </button>
      </div>
    </div>
  );
};

const MenuEditor = ({ item, categories, onDelete, onClose, onSave }) => {
  const [name, setName] = useState(item?.name || 'New Item');
  const [price, setPrice] = useState(item?.price || '0');
  const [category, setCategory] = useState(String(item?.category || '').trim());
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [image, setImage] = useState(item?.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500');
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast.error('Only PNG or JPG images are allowed');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const displayIndex = String(item?.id || 1).padStart(2, '0');

  return (
    <div className="bg-[#F2E8DC] p-10 md:p-12 rounded-3xl shadow-xl min-h-[80vh] flex flex-col relative">
       <button onClick={onClose} className="absolute top-8 right-8 p-2 hover:bg-black/5 rounded-full">
         <X size={32} className="text-[#9F1E22]" />
       </button>
       
       <h2 className="text-black font-black text-5xl mb-10">Menu - {displayIndex}</h2>

       <div className="flex flex-col items-center gap-10 w-full max-w-3xl mx-auto flex-1 justify-center">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-10 w-full">
             <div className="w-60 h-60 md:w-64 md:h-64 bg-gray-200 overflow-hidden shadow-md flex-shrink-0">
                <img
                  src={image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'}
                  className="w-full h-full object-cover"
                  alt="Preview"
                />
             </div>
             <div className="flex flex-col gap-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#E5E7EB] px-12 py-3 rounded-full shadow-sm text-black font-semibold text-2xl hover:bg-gray-200 border border-gray-300 transition-all"
                >
                  Upload
                </button>
                <button
                  onClick={async () => {
                    const itemId = item?.id ?? item?.menuItemId;
                    if (!itemId) {
                      setImage('');
                      return;
                    }
                    const confirmed = window.confirm(
                      `Delete "${item?.name || 'this menu item'}"? This action cannot be undone.`,
                    );
                    if (!confirmed) return;
                    await onDelete(itemId);
                    onClose();
                  }}
                  className="bg-[#E5E7EB] px-12 py-3 rounded-full shadow-sm text-black font-semibold text-2xl hover:bg-gray-200 border border-gray-300 transition-all"
                >
                  {item ? 'Delete Item' : 'Remove Image'}
                </button>
             </div>
          </div>

          <div className="w-full max-w-xl space-y-8">
             <div className="flex items-center gap-6 justify-center md:justify-start">
               <label className="text-black font-black text-5xl w-40 text-right">Name :</label>
               <input 
                 value={name}
                 onChange={(e) => setName(e.target.value)}
                 className="bg-transparent text-[#9F1E22] font-black text-5xl border-none focus:ring-0 placeholder-red-300 p-0"
                 placeholder="Item Name"
               />
             </div>
             <div className="flex items-center gap-6 justify-center md:justify-start">
               <label className="text-black font-black text-5xl w-40 text-right">Price :</label>
               <div className="flex items-center gap-2">
                 <input 
                   value={price}
                   onChange={(e) => setPrice(e.target.value)}
                   className="bg-transparent text-[#9F1E22] font-black text-5xl border-none focus:ring-0 w-40 placeholder-red-300 p-0"
                   placeholder="0"
                 />
                 <span className="text-[#9F1E22] font-black text-5xl">bahts</span>
               </div>
             </div>
             <div className="flex items-center gap-4 justify-center md:justify-start">
               <label className="text-black font-black text-2xl w-40 text-right">Category :</label>
               <select
                 value={isAddingCategory ? '__add_new__' : category}
                 onChange={(e) => {
                   const value = e.target.value;
                   if (value === '__add_new__') {
                     setIsAddingCategory(true);
                     return;
                   }
                   setIsAddingCategory(false);
                   setCategory(value);
                 }}
                 className="bg-white text-[#9F1E22] font-bold text-xl px-4 py-2 rounded-xl border border-[#9F1E22]/20"
               >
                 <option value="" disabled>
                   Select category
                 </option>
                 {categories.map((cat) => (
                   <option key={cat} value={cat}>
                     {cat}
                   </option>
                 ))}
                 <option value="__add_new__">+ Add new category</option>
               </select>
             </div>
             {isAddingCategory && (
               <div className="flex items-center gap-4 justify-center md:justify-start">
                 <label className="text-black font-black text-2xl w-40 text-right">New :</label>
                 <input
                   value={newCategory}
                   onChange={(e) => setNewCategory(e.target.value)}
                   placeholder="e.g. Salad"
                   className="bg-white text-[#9F1E22] font-bold text-xl px-4 py-2 rounded-xl border border-[#9F1E22]/20"
                 />
               </div>
             )}
          </div>

          <button 
            onClick={() => {
              const resolvedCategory = isAddingCategory
                ? String(newCategory || '').trim()
                : String(category || '').trim();
              if (!name.trim()) {
                toast.error('Name is required');
                return;
              }
              if (!resolvedCategory) {
                toast.error('Category is required');
                return;
              }
              onSave({ name, price: Number(price), image, category: resolvedCategory });
            }}
            className="mt-8 bg-[#FFD700] hover:bg-[#FCD34D] text-black font-bold text-2xl py-4 px-28 rounded-full shadow-xl transition-transform active:scale-95"
          >
            Save Changes
          </button>
       </div>
    </div>
  );
};

// 3. Staff Manager
const StaffManager = ({
  staff,
  isLoading,
  hasLoadedStaff,
  staffLoadError,
  onAdd,
  onUpdate,
  onDelete,
  onRefresh,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [selectedStaffId, setSelectedStaffId] = useState(null);

  const selectedStaff = staff.find((person) => person.id === selectedStaffId);
  
  if (isEditing || isAdding) {
    return (
      <StaffEditor
        staff={editingStaff}
        onClose={() => { setIsEditing(false); setIsAdding(false); setEditingStaff(null); }}
        onSave={(payload) => {
          if (isAdding) {
            onAdd(payload);
          } else if (editingStaff) {
            onUpdate(editingStaff.id, payload);
          }
          setIsEditing(false);
          setIsAdding(false);
          setEditingStaff(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-8 h-full flex flex-col">
      {/* Staff Table */}
      <div className="bg-white rounded-t-lg overflow-hidden border border-[#9F1E22] shadow-lg flex-1">
        {/* Red Main Header */}
        <div className="bg-[#9F1E22] text-white p-5 text-3xl font-bold border-b border-[#9F1E22]">
           Staff
        </div>
        
        {/* Blue Sub Header */}
        <div className="grid grid-cols-12 bg-[#E0F2FE] text-black font-bold text-lg p-4 border-b border-[#9F1E22]">
           <div className="col-span-1 pl-4">No</div>
           <div className="col-span-3 border-l-2 border-[#9F1E22]/20 pl-4">Name</div>
           <div className="col-span-4 border-l-2 border-[#9F1E22]/20 pl-4">Email</div>
           <div className="col-span-2 border-l-2 border-[#9F1E22]/20 pl-4">Job</div>
           <div className="col-span-2 border-l-2 border-[#9F1E22]/20 pl-4">Salary</div>
        </div>
        
        {/* Rows */}
        <div className="bg-white">
          {isLoading && (
            <div className="p-6 text-lg font-semibold text-[#9F1E22]">Loading staff...</div>
          )}
          {!isLoading && !!staffLoadError && (
            <div className="p-6 text-lg font-semibold text-[#9F1E22]">{staffLoadError}</div>
          )}
          {!isLoading && !staffLoadError && hasLoadedStaff && staff.length === 0 && (
            <div className="p-6 text-lg font-semibold text-[#9F1E22]">No staff record found in database.</div>
          )}
          {staff.map((person, i) => (
            <div
              key={person.id}
              onClick={() => setSelectedStaffId(person.id)}
              className={`grid grid-cols-12 text-black text-lg font-medium p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors items-center cursor-pointer ${selectedStaffId === person.id ? 'bg-[#FFF7CC]' : ''}`}
            >
               <div className="col-span-1 pl-4">{i + 1}</div>
               <div className="col-span-3 border-l border-gray-200 pl-4">{person.name}</div>
               <div className="col-span-4 border-l border-gray-200 pl-4">{person.email}</div>
               <div className="col-span-2 border-l border-gray-200 pl-4">{person.role}</div>
               <div className="col-span-2 border-l border-gray-200 pl-4">
                 ฿{new Intl.NumberFormat('th-TH').format(Math.round(Number(person.salary || 0)))}
               </div>
            </div>
          ))}
          {/* Filler Rows to mimic spreadsheet look */}
          {[1,2,3,4].map(i => (
             <div key={`e-${i}`} className="grid grid-cols-12 p-6 border-b border-gray-100">
               <div className="col-span-1"></div>
               <div className="col-span-11 border-l border-gray-100"></div>
             </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full pt-4">
         <button
           onClick={() => {
             if (!selectedStaff) {
               toast.info('Select a staff member first');
               return;
             }
             setEditingStaff(selectedStaff);
             setIsEditing(true);
           }}
           className="bg-[#FFD700] hover:bg-[#FCD34D] text-black font-bold text-xl py-4 rounded-full shadow-lg transition-transform active:scale-95"
         >
           Edit
         </button>
         <button
           onClick={() => {
             if (!selectedStaff) {
               toast.info('Select a staff member first');
               return;
             }
             onDelete(selectedStaff.id);
             setSelectedStaffId(null);
           }}
           className="bg-[#FFD700] hover:bg-[#FCD34D] text-black font-bold text-xl py-4 rounded-full shadow-lg transition-transform active:scale-95"
         >
           Remove
         </button>
         <button
           onClick={onRefresh}
           className="bg-[#FFD700] hover:bg-[#FCD34D] text-black font-bold text-xl py-4 rounded-full shadow-lg transition-transform active:scale-95"
         >
           Refresh
         </button>
         <button
           onClick={() => { setIsAdding(true); setEditingStaff(null); }}
           className="bg-[#FFD700] hover:bg-[#FCD34D] text-black font-bold text-xl py-4 rounded-full shadow-lg transition-transform active:scale-95"
         >
           Add
         </button>
      </div>
    </div>
  );
};

const StaffEditor = ({ staff, onClose, onSave }) => {
  const [name, setName] = useState(staff?.name || '');
  const [dateOfBirth, setDateOfBirth] = useState(
    staff?.date_of_birth ? staff.date_of_birth.slice(0, 10) : '',
  );
  const [role, setRole] = useState(staff?.role || 'staff');
  const [email, setEmail] = useState(staff?.email || '');
  const [password, setPassword] = useState('');
  const [salary, setSalary] = useState(staff?.salary ?? '');

  return (
    <div className="bg-[#F2E8DC] p-12 rounded-3xl shadow-xl min-h-[80vh] flex flex-col relative justify-center items-center">
       <button onClick={onClose} className="absolute top-8 right-8 p-2 hover:bg-black/5 rounded-full">
         <X size={32} className="text-[#9F1E22]" />
       </button>
       
       <h2 className="text-[#9F1E22] font-black text-4xl mb-12">{staff ? 'Edit Staff' : 'Add New Staff'}</h2>

       <div className="w-full max-w-2xl space-y-8">
          <div className="flex flex-col gap-2">
            <label className="text-[#9F1E22] font-bold text-xl">Full Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-4 rounded-xl border-none shadow-sm text-lg"
              placeholder="e.g. John Doe"
            />
          </div>

          <div className="grid grid-cols-2 gap-8">
             <div className="flex flex-col gap-2">
               <label className="text-[#9F1E22] font-bold text-xl">Date of Birth</label>
               <input
                 type="date"
                 value={dateOfBirth}
                 onChange={(e) => setDateOfBirth(e.target.value)}
                 className="w-full p-4 rounded-xl border-none shadow-sm text-lg"
               />
             </div>
             <div className="flex flex-col gap-2">
               <label className="text-[#9F1E22] font-bold text-xl">Role</label>
               <select
                 value={role}
                 onChange={(e) => setRole(e.target.value)}
                 className="w-full p-4 rounded-xl border-none shadow-sm text-lg bg-white"
               >
                 <option>staff</option>
                 <option>chef</option>
                 <option>cashier</option>
                 <option>manager</option>
               </select>
             </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[#9F1E22] font-bold text-xl">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 rounded-xl border-none shadow-sm text-lg"
              placeholder="email@example.com"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[#9F1E22] font-bold text-xl">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 rounded-xl border-none shadow-sm text-lg"
              placeholder="••••••••"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[#9F1E22] font-bold text-xl">Salary (THB)</label>
            <input
              type="text"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className="w-full p-4 rounded-xl border-none shadow-sm text-lg"
              placeholder="0"
              inputMode="numeric"
            />
          </div>

          <div className="pt-8 flex justify-center">
             <button 
               onClick={() => {
                 if (!name || !email) {
                   toast.error('Name and email are required');
                   return;
                 }
                 const cleanedSalary = String(salary ?? '').replace(/[^\d.]/g, '');
                 const numericSalary = cleanedSalary ? Number(cleanedSalary) : 0;
                 const payload = {
                   name,
                   email,
                   role,
                   salary: Math.round(numericSalary),
                   date_of_birth: dateOfBirth || null,
                 };
                 const trimmedPassword = String(password || '').trim();
                 if (trimmedPassword) {
                   payload.password = trimmedPassword;
                 }
                 onSave(payload);
               }}
               className="bg-[#FFD700] hover:bg-[#FCD34D] text-black font-bold text-xl py-4 px-24 rounded-full shadow-xl transition-transform active:scale-95"
             >
               Save Staff
             </button>
          </div>
       </div>
    </div>
  );
}

// 4. Table Manager
const TableManager = ({ tables, orders = [], isLoading, onAdd, onUpdate, onDelete, onRefresh }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [selectedTableId, setSelectedTableId] = useState(null);

  const selectedTable = tables.find((table) => table.id === selectedTableId);
  const tableStatusById = useMemo(() => {
    const statuses = new Map(
      (tables || []).map((table) => [table.id, String(table?.status || 'free').toLowerCase()]),
    );
    for (const order of orders || []) {
      const orderStatus = String(order?.status || '').toLowerCase();
      if (!['paid', 'canceled'].includes(orderStatus)) {
        statuses.set(order?.tableId, 'seated');
      }
    }
    return statuses;
  }, [orders, tables]);
  const isSelectedTableSeated =
    selectedTable && tableStatusById.get(selectedTable.id) === 'seated';

  if (isEditing || isAdding) {
    return (
      <TableEditor
        table={editingTable}
        onClose={() => {
          setIsEditing(false);
          setIsAdding(false);
          setEditingTable(null);
        }}
        onSave={(payload) => {
          if (isAdding) {
            onAdd(payload);
          } else if (editingTable) {
            const currentStatus = tableStatusById.get(editingTable.id) || 'free';
            if (currentStatus === 'seated') {
              toast.error('Cannot edit a seated table');
              return;
            }
            onUpdate(editingTable.id, payload);
          }
          setIsEditing(false);
          setIsAdding(false);
          setEditingTable(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-8 h-full flex flex-col">
      <div className="bg-white rounded-t-lg overflow-hidden border border-[#9F1E22] shadow-lg flex-1">
        <div className="bg-[#9F1E22] text-white p-5 text-3xl font-bold border-b border-[#9F1E22]">
          Tables
        </div>
        <div className="grid grid-cols-12 bg-[#E0F2FE] text-black font-bold text-lg p-4 border-b border-[#9F1E22]">
          <div className="col-span-2 pl-4">No</div>
          <div className="col-span-4 border-l-2 border-[#9F1E22]/20 pl-4">Table Number</div>
          <div className="col-span-3 border-l-2 border-[#9F1E22]/20 pl-4">Seats</div>
          <div className="col-span-3 border-l-2 border-[#9F1E22]/20 pl-4">Status</div>
        </div>

        <div className="bg-white">
          {isLoading && (
            <div className="p-6 text-lg font-semibold text-[#9F1E22]">Loading tables...</div>
          )}
          {tables.map((table, i) => {
            const tableStatus = tableStatusById.get(table.id) || 'free';
            return (
              <div
                key={table.id}
                onClick={() => setSelectedTableId(table.id)}
                className={`grid grid-cols-12 text-black text-lg font-medium p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors items-center cursor-pointer ${selectedTableId === table.id ? 'bg-[#FFF7CC]' : ''}`}
              >
                <div className="col-span-2 pl-4">{table.tableId || i + 1}</div>
                <div className="col-span-4 border-l border-gray-200 pl-4">{table.number}</div>
                <div className="col-span-3 border-l border-gray-200 pl-4">{table.seats}</div>
                <div className="col-span-3 border-l border-gray-200 pl-4 capitalize">{tableStatus}</div>
              </div>
            );
          })}
          {[1, 2, 3, 4].map((i) => (
            <div key={`t-e-${i}`} className="grid grid-cols-12 p-6 border-b border-gray-100">
              <div className="col-span-1" />
              <div className="col-span-11 border-l border-gray-100" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full pt-4">
        <button
          onClick={() => {
            if (!selectedTable) {
              toast.info('Select a table first');
              return;
            }
            if (isSelectedTableSeated) {
              toast.info('Seated table cannot be edited');
              return;
            }
            setEditingTable(selectedTable);
            setIsEditing(true);
          }}
          disabled={isSelectedTableSeated}
          className={`text-black font-bold text-xl py-4 rounded-full shadow-lg transition-transform ${
            isSelectedTableSeated
              ? 'bg-[#FFD700]/50 cursor-not-allowed'
              : 'bg-[#FFD700] hover:bg-[#FCD34D] active:scale-95'
          }`}
        >
          Edit
        </button>
        <button
          onClick={async () => {
            if (!selectedTable) {
              toast.info('Select a table first');
              return;
            }
            if (isSelectedTableSeated) {
              toast.info('Seated table cannot be removed');
              return;
            }
            const confirmed = window.confirm(
              `Delete table "${selectedTable.number}"? This action cannot be undone.`,
            );
            if (!confirmed) return;
            await onDelete(selectedTable.id);
            setSelectedTableId(null);
          }}
          disabled={isSelectedTableSeated}
          className={`text-black font-bold text-xl py-4 rounded-full shadow-lg transition-transform ${
            isSelectedTableSeated
              ? 'bg-[#FFD700]/50 cursor-not-allowed'
              : 'bg-[#FFD700] hover:bg-[#FCD34D] active:scale-95'
          }`}
        >
          Remove
        </button>
        <button
          onClick={onRefresh}
          className="bg-[#FFD700] hover:bg-[#FCD34D] text-black font-bold text-xl py-4 rounded-full shadow-lg transition-transform active:scale-95"
        >
          Refresh
        </button>
        <button
          onClick={() => {
            setIsAdding(true);
            setEditingTable(null);
          }}
          className="bg-[#FFD700] hover:bg-[#FCD34D] text-black font-bold text-xl py-4 rounded-full shadow-lg transition-transform active:scale-95"
        >
          Add
        </button>
      </div>
    </div>
  );
};

const TableEditor = ({ table, onClose, onSave }) => {
  const [number, setNumber] = useState(table?.number || '');
  const [seats, setSeats] = useState(table?.seats ?? '');

  return (
    <div className="bg-[#F2E8DC] p-12 rounded-3xl shadow-xl min-h-[80vh] flex flex-col relative justify-center items-center">
      <button onClick={onClose} className="absolute top-8 right-8 p-2 hover:bg-black/5 rounded-full">
        <X size={32} className="text-[#9F1E22]" />
      </button>

      <h2 className="text-[#9F1E22] font-black text-4xl mb-12">{table ? 'Edit Table' : 'Add New Table'}</h2>

      <div className="w-full max-w-2xl space-y-8">
        <div className="flex flex-col gap-2">
          <label className="text-[#9F1E22] font-bold text-xl">Table Number</label>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="w-full p-4 rounded-xl border-none shadow-sm text-lg"
            placeholder="e.g. 1, A1, VIP-2"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[#9F1E22] font-bold text-xl">Seats</label>
          <input
            type="number"
            min="1"
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
            className="w-full p-4 rounded-xl border-none shadow-sm text-lg"
            placeholder="4"
          />
        </div>

        <div className="pt-8 flex justify-center">
          <button
            onClick={() => {
              const trimmedNumber = String(number || '').trim();
              const numericSeats = Number(seats);
              if (!trimmedNumber) {
                toast.error('Table number is required');
                return;
              }
              if (!Number.isFinite(numericSeats) || numericSeats <= 0) {
                toast.error('Seats must be greater than 0');
                return;
              }
              onSave({ number: trimmedNumber, seats: Math.round(numericSeats) });
            }}
            className="bg-[#FFD700] hover:bg-[#FCD34D] text-black font-bold text-xl py-4 px-24 rounded-full shadow-xl transition-transform active:scale-95"
          >
            Save Table
          </button>
        </div>
      </div>
    </div>
  );
};

// 5. Reports
const Reports = ({ analytics, orders }) => {
  const [reportType, setReportType] = useState('monthly');
  const [selectedReportMonth, setSelectedReportMonth] = useState(getCurrentMonthValue);
  const [monthlyMenuRowsFromDb, setMonthlyMenuRowsFromDb] = useState([]);
  const [isMonthlyMenuLoading, setIsMonthlyMenuLoading] = useState(false);
  const [monthlyMenuError, setMonthlyMenuError] = useState('');
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const validOrders = useMemo(
    () => orders.filter((order) => order.status !== 'canceled'),
    [orders],
  );
  const paidOrders = useMemo(
    () => validOrders.filter((order) => order.status === 'paid'),
    [validOrders],
  );
  const hasAutoSelectedMonthRef = useRef(false);
  const dailyRows = useMemo(
    () =>
      paidOrders.flatMap((order) =>
        (order.items || []).map((item, index) => ({
          key: `${order.id}-${index}`,
          orderId: order.id,
          item: item.name,
          price: Number(item.price || 0),
          quantity: Number(item.quantity || 0),
          time: new Date(order.paidAt || order.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          total: Number(item.price || 0) * Number(item.quantity || 0) * (1 + analytics.taxRate),
        })),
      ),
    [paidOrders, analytics.taxRate],
  );
  const dailyTotal = dailyRows.reduce((sum, row) => sum + row.total, 0);
  const nextMonthValue = shiftMonthValue(selectedReportMonth, 1);
  const isNextMonthDisabled = isFutureMonthValue(nextMonthValue);
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const selectedMonthParts = getMonthParts(selectedReportMonth);
  const selectedYear = selectedMonthParts?.year ?? currentYear;
  const selectedMonthNumber = selectedMonthParts?.month ?? currentMonth;
  const minYear = 1900;
  const yearOptions = useMemo(() => {
    const years = [];
    for (let year = currentYear; year >= minYear; year -= 1) {
      years.push(year);
    }
    return years;
  }, [currentYear]);
  const applySelectedMonth = (nextValue) => {
    if (!nextValue) return;
    if (isFutureMonthValue(nextValue)) {
      toast.error('Future month is not allowed');
      return;
    }
    setSelectedReportMonth(nextValue);
  };

  useEffect(() => {
    if (hasAutoSelectedMonthRef.current) return;
    if (paidOrders.length === 0) return;
    const latestPaidDate = paidOrders.reduce((latest, order) => {
      const next = new Date(order.paidAt || order.createdAt || 0);
      return Number(next) > Number(latest) ? next : latest;
    }, new Date(0));
    if (Number.isNaN(Number(latestPaidDate)) || Number(latestPaidDate) <= 0) return;
    const year = latestPaidDate.getFullYear();
    const month = String(latestPaidDate.getMonth() + 1).padStart(2, '0');
    setSelectedReportMonth(`${year}-${month}`);
    hasAutoSelectedMonthRef.current = true;
  }, [paidOrders]);

  const fetchMonthlyMenuReport = async () => {
    setIsMonthlyMenuLoading(true);
    setMonthlyMenuError('');
    try {
      const [year, month] = String(selectedReportMonth || '').split('-');
      const params = new URLSearchParams();
      if (year && month) {
        params.set('year', year);
        params.set('month', String(Number(month)));
      }
      const queryString = params.toString();
      const reportPath = queryString
        ? `reports/monthly-menu?${queryString}`
        : 'reports/monthly-menu';
      const res = await fetch(apiUrl(reportPath), { cache: 'no-store' });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to load monthly menu report'));
      const data = await res.json();
      const mapped = (Array.isArray(data) ? data : []).map((row) => ({
        month: row.month,
        item: row.item,
        quantity: Number(row.quantity || 0),
        revenue: Number(row.revenue || 0),
      }));
      setMonthlyMenuRowsFromDb(mapped);
    } catch (error) {
      setMonthlyMenuError(error?.message || 'Failed to load monthly menu report');
    } finally {
      setIsMonthlyMenuLoading(false);
    }
  };

  useEffect(() => {
    if (reportType !== 'monthly') return;

    fetchMonthlyMenuReport();
    const intervalId = setInterval(fetchMonthlyMenuReport, 10000);
    return () => clearInterval(intervalId);
  }, [reportType, selectedReportMonth]);

  const monthlyGrandTotals = useMemo(
    () =>
      monthlyMenuRowsFromDb.reduce(
        (acc, row) => ({
          quantity: acc.quantity + row.quantity,
          revenue: acc.revenue + row.revenue,
        }),
        { quantity: 0, revenue: 0 },
      ),
    [monthlyMenuRowsFromDb],
  );

  return (
    <div className="bg-[#F2E8DC] rounded-3xl shadow-xl overflow-hidden p-8 min-h-[80vh] flex flex-col">
       {/* Toggle */}
       <div className="flex justify-center gap-12 mb-10">
         <button 
           onClick={() => setReportType('daily')}
           className={`px-12 py-3 rounded-full font-bold text-xl shadow-md transition-all ${reportType === 'daily' ? 'bg-white text-black scale-105' : 'bg-white/50 text-gray-500'}`}
         >
           Daily
         </button>
         <button 
           onClick={() => setReportType('monthly')}
           className={`px-12 py-3 rounded-full font-bold text-xl shadow-md transition-all ${reportType === 'monthly' ? 'bg-white text-black scale-105' : 'bg-white/50 text-gray-500'}`}
         >
           Monthly
         </button>
       </div>

       {/* Table Content */}
       <div className="bg-white rounded-xl overflow-hidden shadow-sm flex-1">
         {reportType === 'daily' ? (
            <>
              <div className="rounded-2xl border border-[#9F1E22]/10 overflow-hidden shadow-sm">
                <div className="grid grid-cols-[1.6fr_3.4fr_1.8fr_1.8fr_2.2fr] bg-gradient-to-r from-[#FFD700] to-[#FCD34D] text-black font-black text-base uppercase tracking-wide px-6 py-5">
                  <div>Order Number</div>
                  <div>Item</div>
                  <div className="text-right">Price</div>
                  <div className="text-right">Time</div>
                  <div className="text-right">Total (Tax Incl.)</div>
                </div>
                <div className="divide-y divide-gray-100">
                  {dailyRows.map((row) => (
                    <div
                      key={row.key}
                      className="grid grid-cols-[1.6fr_3.4fr_1.8fr_1.8fr_2.2fr] px-6 py-5 text-black font-medium text-lg hover:bg-[#FFFBEA] transition-colors even:bg-gray-50/60"
                    >
                      <div className="font-semibold">{row.orderId}</div>
                      <div>{row.item}</div>
                      <div className="text-right">฿{row.price.toFixed(2)}</div>
                      <div className="text-right">{row.time}</div>
                      <div className="text-right font-black text-[#9F1E22]">฿{row.total.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
                {dailyRows.length === 0 && (
                  <div className="p-10 text-center text-[#9F1E22]/70 italic">No paid transactions yet.</div>
                )}
                <div className="grid grid-cols-[1.6fr_3.4fr_1.8fr_1.8fr_2.2fr] bg-[#9F1E22] text-white px-6 py-5 text-lg font-bold">
                  <div className="uppercase tracking-wide">Total</div>
                  <div></div>
                  <div></div>
                  <div></div>
                  <div className="text-right">฿{dailyTotal.toFixed(2)}</div>
                </div>
              </div>
            </>
         ) : (
            <>
              <div className="mb-5 flex justify-end px-1">
                <div className="flex w-full items-center justify-between rounded-xl bg-[#E5E7EB] px-3 py-2 text-[#111827] shadow-sm">
                  <button
                    type="button"
                    onClick={() => setSelectedReportMonth((prev) => shiftMonthValue(prev, -1))}
                    className="rounded-md p-2 transition-colors hover:bg-black/5"
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <div className="flex items-center gap-3 text-3xl font-semibold">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setPickerYear(selectedYear);
                          setIsMonthPickerOpen((prev) => !prev);
                        }}
                        className="rounded-md p-1 transition-colors hover:bg-black/5"
                        aria-label="Open month and year picker"
                      >
                        <CalendarDays size={24} />
                      </button>
                      {isMonthPickerOpen && (
                        <div className="absolute left-0 top-11 z-20 w-72 rounded-xl border border-black/10 bg-white p-3 shadow-xl">
                          <div className="mb-3">
                            <select
                              value={pickerYear}
                              onChange={(e) => setPickerYear(Number.parseInt(e.target.value, 10))}
                              className="w-full rounded-md border border-black/15 px-3 py-2 text-base font-semibold outline-none focus:border-[#9F1E22]"
                            >
                              {yearOptions.map((year) => (
                                <option key={year} value={year}>
                                  {year}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {MONTH_LABELS.map((label, index) => {
                              const month = index + 1;
                              const monthValue = buildMonthValue(pickerYear, month);
                              const isDisabled = isFutureMonthValue(monthValue);
                              const isSelected = pickerYear === selectedYear && month === selectedMonthNumber;
                              return (
                                <button
                                  key={`${pickerYear}-${label}`}
                                  type="button"
                                  onClick={() => {
                                    if (isDisabled) return;
                                    applySelectedMonth(monthValue);
                                    setIsMonthPickerOpen(false);
                                  }}
                                  disabled={isDisabled}
                                  className={`rounded-md border px-2 py-2 text-sm font-semibold transition-colors ${
                                    isSelected
                                      ? 'border-[#9F1E22] bg-[#9F1E22] text-white'
                                      : 'border-black/15 bg-white text-black hover:bg-[#FFF5D0]'
                                  } disabled:cursor-not-allowed disabled:opacity-35`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    <span>{formatMonthValue(selectedReportMonth)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isNextMonthDisabled) return;
                      setSelectedReportMonth(nextMonthValue);
                    }}
                    disabled={isNextMonthDisabled}
                    className="rounded-md p-2 transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    aria-label="Next month"
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>
              </div>
              <div className="rounded-2xl border border-[#9F1E22]/10 overflow-hidden shadow-sm">
                <div className="grid grid-cols-[1.2fr_3.8fr_2fr_2fr] bg-gradient-to-r from-[#FFD700] to-[#FCD34D] text-black font-black text-base uppercase tracking-wide px-6 py-5">
                  <div>Month</div>
                  <div>Menu Item</div>
                  <div className="text-right">Total Order Qty</div>
                  <div className="text-right">Revenue</div>
                </div>
                <div className="divide-y divide-gray-100">
                {monthlyMenuRowsFromDb.map((row) => (
                  <div
                    key={`${row.month}-${row.item}`}
                    className="grid grid-cols-[1.2fr_3.8fr_2fr_2fr] px-6 py-5 text-black font-medium text-lg hover:bg-[#FFFBEA] transition-colors even:bg-gray-50/60"
                  >
                    <div>
                      <span className="inline-flex items-center rounded-full bg-[#9F1E22]/10 px-3 py-1 text-sm font-bold text-[#9F1E22]">
                        {row.month}
                      </span>
                    </div>
                    <div className="font-semibold">{row.item}</div>
                    <div className="text-right">
                      <span className="inline-flex min-w-16 justify-center rounded-full bg-[#F2E8DC] px-3 py-1 font-bold">
                        {row.quantity}
                      </span>
                    </div>
                    <div className="text-right font-black text-[#9F1E22]">
                      ฿{row.revenue.toFixed(2)}
                    </div>
                  </div>
                ))}
                {isMonthlyMenuLoading && (
                  <div className="p-10 text-center text-[#9F1E22]/70 italic">
                    Loading monthly menu report...
                  </div>
                )}
                {!isMonthlyMenuLoading && !!monthlyMenuError && (
                  <div className="p-10 text-center text-[#9F1E22]/70 italic">{monthlyMenuError}</div>
                )}
                {!isMonthlyMenuLoading && !monthlyMenuError && monthlyMenuRowsFromDb.length === 0 && (
                  <div className="p-10 text-center text-[#9F1E22]/70 italic">
                    No monthly menu report data found in database.
                  </div>
                )}
                </div>
                {monthlyMenuRowsFromDb.length > 0 && (
                  <div className="grid grid-cols-[1.2fr_3.8fr_2fr_2fr] bg-[#9F1E22] text-white px-6 py-5 text-lg font-bold">
                    <div className="uppercase tracking-wide">Grand Total</div>
                    <div>All Menu Items</div>
                    <div className="text-right">{monthlyGrandTotals.quantity}</div>
                    <div className="text-right">฿{monthlyGrandTotals.revenue.toFixed(2)}</div>
                  </div>
                )}
              </div>
            </>
         )}
       </div>
    </div>
  );
};
