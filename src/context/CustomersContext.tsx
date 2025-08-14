import React, { createContext, useContext, useState, useEffect } from "react";
import { Contact } from "@/types/customer";
import { supabase } from "@/lib/supabase";

// Define the customer interface
export interface Customer {
  id: string;
  companyName: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  faxNumber: string;
  industry: string;
  invoiceOwner: string;
  jobTitle?: string;
  department?: string;
  companySize?: string;
  estimatedAnnualMerchSpend?: string;
  socialMedia?: {
    linkedin?: string;
    facebook?: string;
    twitter?: string;
    website?: string;
  };
  contacts: Contact[];
  billingAddress: {
    address1: string;
    address2: string;
    city: string;
    stateProvince: string;
    zipCode: string;
    country: string;
  };
  shippingAddress: {
    address1: string;
    address2: string;
    city: string;
    stateProvince: string;
    zipCode: string;
    country: string;
  };
  taxInfo: {
    taxId: string;
    taxRate: string;
    taxExemptionNumber: string;
  };
}

interface CustomersContextType {
  customers: Customer[];
  selectedCustomer: Customer | null;
  loading: boolean;
  error: string | null;
  addCustomer: (customer: Omit<Customer, "id" | "contacts">) => Promise<Customer>;
  selectCustomer: (customerId: string) => void;
  getCustomerById: (customerId: string) => Customer | undefined;
  addContactToCustomer: (customerId: string, contact: Omit<Contact, "id">) => void;
  updateCustomer: (customerId: string, data: Partial<Customer>) => void;
  updateCustomerContact: (customerId: string, contactId: string, data: Partial<Contact>) => void;
  fetchCustomers: () => Promise<void>;
  deleteCustomer: (customerId: string) => Promise<{ success: boolean; error?: string }>;
}

// Interface for database customer data
interface DatabaseCustomer {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: any; // JSONB field
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// Helper function to convert database customer to frontend Customer interface
const convertDatabaseCustomer = (dbCustomer: DatabaseCustomer): Customer => {
  const address = dbCustomer.address || {};
  
  return {
    id: dbCustomer.id,
    companyName: dbCustomer.company || 'Unknown Company',
    firstName: dbCustomer.name.split(' ')[0] || '',
    lastName: dbCustomer.name.split(' ').slice(1).join(' ') || '',
    email: dbCustomer.email || '',
    phoneNumber: dbCustomer.phone || '',
    faxNumber: '',
    industry: 'business', // Default industry
    invoiceOwner: 'Finance',
    jobTitle: '',
    department: '',
    companySize: '',
    estimatedAnnualMerchSpend: '',
    socialMedia: {
      linkedin: '',
      facebook: '',
      twitter: '',
      website: ''
    },
    contacts: [], // No contacts system implemented yet
    billingAddress: {
      address1: address.street || '',
      address2: '',
      city: address.city || '',
      stateProvince: address.state || '',
      zipCode: address.zip || '',
      country: address.country || ''
    },
    shippingAddress: {
      address1: address.street || '',
      address2: '',
      city: address.city || '',
      stateProvince: address.state || '',
      zipCode: address.zip || '',
      country: address.country || ''
    },
    taxInfo: {
      taxId: '',
      taxRate: '8',
      taxExemptionNumber: ''
    }
  };
};

const CustomersContext = createContext<CustomersContextType | undefined>(undefined);

export const useCustomers = () => {
  const context = useContext(CustomersContext);
  if (!context) {
    throw new Error("useCustomers must be used within a CustomersProvider");
  }
  return context;
};

interface CustomersProviderProps {
  children: React.ReactNode;
}

export const CustomersProvider: React.FC<CustomersProviderProps> = ({ children }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch customers from database
  const fetchCustomers = async () => {
    console.log('🔍 [DEBUG] CustomersContext - fetchCustomers called');
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 [DEBUG] CustomersContext - calling supabase.rpc("get_customers")');
      const { data, error } = await supabase.rpc('get_customers');
      
      console.log('🔍 [DEBUG] CustomersContext - RPC response data:', data);
      console.log('🔍 [DEBUG] CustomersContext - RPC response error:', error);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        console.log('🔍 [DEBUG] CustomersContext - processing customers data:', data[0]);
        const customersData = data[0].customers;
        console.log('🔍 [DEBUG] CustomersContext - extracted customers array:', customersData);
        
        if (customersData && Array.isArray(customersData)) {
          console.log('🔍 [DEBUG] CustomersContext - converting customers:', customersData.length);
          const convertedCustomers = customersData.map(convertDatabaseCustomer);
          console.log('🔍 [DEBUG] CustomersContext - converted customers:', convertedCustomers);
          setCustomers(convertedCustomers);
        } else {
          console.log('🔍 [DEBUG] CustomersContext - no customers data or not array, setting empty');
          setCustomers([]);
        }
      } else {
        console.log('🔍 [DEBUG] CustomersContext - no data returned, setting empty');
        setCustomers([]);
      }
    } catch (err) {
      console.error('🔍 [DEBUG] CustomersContext - Error fetching customers:', err);
      console.error('🔍 [DEBUG] CustomersContext - Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        details: err.details || 'No details',
        hint: err.hint || 'No hint',
        code: err.code || 'No code'
      });
      setError(err instanceof Error ? err.message : 'Failed to fetch customers');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  // Load customers on mount
  useEffect(() => {
    fetchCustomers();
  }, []);

  const addCustomer = async (customerData: Omit<Customer, "id" | "contacts">): Promise<Customer> => {
    try {
      // Check if the user has an organization
      const { data: userInfo, error: userError } = await supabase.rpc('get_user_org_info');
      
      if (userError || !userInfo || userInfo.length === 0) {
        throw new Error('User organization not found. Please ensure you are properly signed up and have an organization.');
      }
      // Create customer in database using create_customer RPC
      const { data, error } = await supabase.rpc('create_customer', {
        customer_name: `${customerData.firstName} ${customerData.lastName}`.trim(),
        customer_company: customerData.companyName || null,
        customer_email: customerData.email || null,
        customer_phone: customerData.phoneNumber || null,
        customer_address: {
          street: customerData.billingAddress.address1,
          city: customerData.billingAddress.city,
          state: customerData.billingAddress.stateProvince,
          zip: customerData.billingAddress.zipCode,
          country: customerData.billingAddress.country
        },
        customer_notes: `Industry: ${customerData.industry || 'N/A'}, Job Title: ${customerData.jobTitle || 'N/A'}`,
        customer_status: 'active'
      });



      if (error) throw error;

      // The create_customer function returns a JSONB object with success, customer_id, message
      if (data && typeof data === 'object' && data.success && data.customer_id) {
        // Now fetch the created customer to get full details
        const { data: customerData, error: fetchError } = await supabase.rpc('get_customer', {
          customer_id: data.customer_id
        });
        
        if (fetchError) {
          console.error('🔍 [DEBUG] CustomersContext - Error fetching created customer:', fetchError);
          throw fetchError;
        }
        
        if (customerData && typeof customerData === 'object') {
          // Convert database customer to frontend format
          const newCustomer = convertDatabaseCustomer(customerData);
          
          // Add to local state
          setCustomers(prev => [...prev, newCustomer]);
          
          return newCustomer;
        } else {
          throw new Error('Could not fetch created customer details');
        }
      } else {
        console.log('🔍 [DEBUG] CustomersContext - unexpected response format:', data);
        throw new Error('Customer creation failed - unexpected response format');
      }
    } catch (err) {
      console.error('🔍 [DEBUG] CustomersContext - Error creating customer:', err);
      console.error('🔍 [DEBUG] CustomersContext - Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        details: err.details || 'No details',
        hint: err.hint || 'No hint',
        code: err.code || 'No code'
      });
      
      // Fallback to local-only customer for now
      const fallbackCustomer: Customer = {
        ...customerData,
      id: `customer-${Date.now()}`,
      contacts: []
    };
    
      setCustomers(prev => [...prev, fallbackCustomer]);
      return fallbackCustomer;
    }
  };

  const selectCustomer = (customerId: string) => {
    console.log('🔍 [DEBUG] CustomersContext - selectCustomer called with:', customerId);
    const customer = customers.find(c => c.id === customerId);
    console.log('🔍 [DEBUG] CustomersContext - found customer:', customer);
    setSelectedCustomer(customer || null);
    console.log('🔍 [DEBUG] CustomersContext - selectedCustomer set to:', customer || null);
  };

  const getCustomerById = (customerId: string): Customer | undefined => {
    return customers.find(c => c.id === customerId);
  };

  const addContactToCustomer = (customerId: string, contactData: Omit<Contact, "id">) => {
    const newContact: Contact = {
      ...contactData,
      id: `contact-${Date.now()}`
    };

    setCustomers(prev => prev.map(customer => 
      customer.id === customerId 
        ? { ...customer, contacts: [...customer.contacts, newContact] }
        : customer
    ));

    // Update selected customer if it's the one being modified
    if (selectedCustomer?.id === customerId) {
      setSelectedCustomer(prev => prev ? {
        ...prev,
        contacts: [...prev.contacts, newContact]
      } : null);
    }
  };

  const updateCustomer = (customerId: string, data: Partial<Customer>) => {
    setCustomers(prev => prev.map(customer => 
      customer.id === customerId ? { ...customer, ...data } : customer
    ));

    // Update selected customer if it's the one being modified
    if (selectedCustomer?.id === customerId) {
      setSelectedCustomer(prev => prev ? { ...prev, ...data } : null);
    }
  };

  const updateCustomerContact = (customerId: string, contactId: string, data: Partial<Contact>) => {
    setCustomers(prev => prev.map(customer => 
      customer.id === customerId 
        ? {
            ...customer,
            contacts: customer.contacts.map(contact =>
          contact.id === contactId ? { ...contact, ...data } : contact
            )
          }
        : customer
    ));

    // Update selected customer if it's the one being modified
    if (selectedCustomer?.id === customerId) {
      setSelectedCustomer(prev => prev ? {
        ...prev,
        contacts: prev.contacts.map(contact =>
          contact.id === contactId ? { ...contact, ...data } : contact
        )
      } : null);
    }
  };

  const deleteCustomer = async (customerId: string) => {
    console.log('🔍 [DEBUG] CustomersContext - deleteCustomer called with ID:', customerId);
    
    try {
      const { data, error } = await supabase.rpc('delete_customer', {
        p_customer_id: customerId
      });

      if (error) {
        throw error;
      }

      console.log('🔍 [DEBUG] CustomersContext - Customer deletion successful');
      
      // Remove customer from local state
      setCustomers(prev => prev.filter(customer => customer.id !== customerId));
      
      // Clear selected customer if it was the deleted one
      if (selectedCustomer?.id === customerId) {
        setSelectedCustomer(null);
      }

      return { success: true };
    } catch (err) {
      console.error('🔍 [DEBUG] CustomersContext - Error deleting customer:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to delete customer' 
      };
    }
  };

  const value: CustomersContextType = {
      customers, 
      selectedCustomer, 
    loading,
    error,
      addCustomer, 
      selectCustomer,
      getCustomerById,
      addContactToCustomer,
      updateCustomer,
    updateCustomerContact,
    fetchCustomers,
    deleteCustomer
  };

  return (
    <CustomersContext.Provider value={value}>
      {children}
    </CustomersContext.Provider>
  );
};