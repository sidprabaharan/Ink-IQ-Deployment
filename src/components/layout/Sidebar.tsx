
import { useState } from 'react';
import {
  BarChart2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DollarSign,
  FileText,
  Home,
  LogOut,
  Mail,
  PlayCircle,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Store,
  User,
  Users,
  ClipboardList,
  Package2,
  Truck,
  Network,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useOrganization } from '@/context/OrganizationContext';

interface SidebarProps {
  collapsed: boolean;
  toggleCollapse: () => void;
}

export function Sidebar({ collapsed, toggleCollapse }: SidebarProps) {
  const location = useLocation();
  const { organization } = useOrganization();
  const role = (organization?.user_role || '').toLowerCase();
  const isManager = ['production_manager', 'manager', 'admin', 'owner'].includes(role);
  
  const navigationItems = [
    {
      name: 'Dashboard',
      icon: Home,
      path: '/',
    },
    {
      name: 'Calendar',
      icon: Calendar,
      path: '/calendar',
    },
    {
      name: 'Leads',
      icon: User,
      path: '/leads',
    },
    {
      name: 'Quotes',
      icon: FileText,
      path: '/quotes',
    },
    {
      name: 'Invoices',
      icon: FileText,
      path: '/invoices',
    },
    {
      name: 'Customers',
      icon: Users,
      path: '/customers',
    },
    {
      name: 'Tasks',
      icon: ClipboardList,
      path: '/tasks',
    },
    {
      name: 'Production',
      icon: Truck,
      path: '/production',
    },
    {
      name: 'Products',
      icon: Package2,
      path: '/products',
    },
    {
      name: 'Purchase Orders',
      icon: ShoppingCart,
      path: '/purchase-orders',
    },
    {
      name: 'Emails',
      icon: Mail,
      path: '/messages',
    },
    {
      name: 'Artwork Files',
      icon: FileText,
      path: '/artwork-files',
    },
    {
      name: 'Expenses',
      icon: DollarSign,
      path: '/expenses',
    },
  ];

  const bottomItems = [
    { name: 'Settings', icon: Settings, path: '/settings' } as const,
    { name: 'Logout', icon: LogOut, path: '/logout' } as const,
  ];

  return (
    <aside className={`${collapsed ? 'w-[64px]' : 'w-[230px]'} border-r h-full flex flex-col bg-white transition-width duration-300`}>
      <div className={`p-4 flex items-center gap-2 border-b ${collapsed ? 'justify-center' : ''}`}>
        <img 
          src="/lovable-uploads/a254e6c0-7bd5-4ee1-a1d3-124051d69585.png" 
          alt="InkIQ Logo" 
          className="h-8 w-auto"
        />
      </div>
      
      <div className="relative">
        <button
          onClick={toggleCollapse}
          className="absolute -right-3 top-4 bg-white border rounded-full p-1 shadow-md z-10 hover:bg-gray-50"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-2">
        <ul className={`space-y-1 ${collapsed ? 'px-1' : 'px-2'}`}>
          {navigationItems.map((item) => (
            <li key={item.name}>
              <Link
                to={item.path}
                title={collapsed ? item.name : undefined}
                className={`flex items-center gap-3 rounded-md text-sm font-medium transition-colors ${
                  collapsed ? 'justify-center p-2' : 'px-3 py-2'
                } ${
                  location.pathname === item.path
                    ? 'bg-inkiq-primary/10 text-inkiq-primary'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <item.icon size={18} />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="border-t py-2">
        <ul className={`space-y-1 ${collapsed ? 'px-1' : 'px-2'}`}>
          {bottomItems.map((item) => (
            <li key={item.name}>
              <Link
                to={item.path}
                title={collapsed ? item.name : undefined}
                className={`flex items-center gap-3 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors ${
                  collapsed ? 'justify-center p-2' : 'px-3 py-2'
                } ${
                  location.pathname === item.path
                    ? 'bg-inkiq-primary/10 text-inkiq-primary'
                    : ''
                }`}
              >
                <item.icon size={18} />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
