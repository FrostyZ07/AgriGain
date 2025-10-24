import { Authenticated, Unauthenticated, useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster, toast } from "sonner";
import { useState, useEffect } from "react";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-green-50 to-blue-50">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">🌾</span>
          </div>
          <h2 className="text-xl font-bold text-green-800">Agri-Gain</h2>
        </div>
        <Authenticated>
          <SignOutButton />
        </Authenticated>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl mx-auto">
          <Content />
        </div>
      </main>
      <Toaster position="top-right" />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-green-800 mb-4">
          🌾 Transform Your Agricultural Waste
        </h1>
        <Authenticated>
          <p className="text-xl text-gray-600 mb-6">
            Welcome back, {loggedInUser?.email?.split('@')[0] || "farmer"}! 
            Turn your bio-waste into opportunities.
          </p>
        </Authenticated>
        <Unauthenticated>
          <p className="text-xl text-gray-600 mb-6">
            AI-powered platform to help farmers quantify bio-waste and discover profitable opportunities
          </p>
        </Unauthenticated>
      </div>

      <Unauthenticated>
        <div className="max-w-md mx-auto">
          <SignInForm />
        </div>
      </Unauthenticated>

      <Authenticated>
        <AgriGainDashboard />
      </Authenticated>
    </div>
  );
}

function AgriGainDashboard() {
  const [activeTab, setActiveTab] = useState<'log' | 'history' | 'profile'>('log');
  
  // Initialize system on first load
  const initializeSystem = useMutation(api.initialization.initializeSystem);
  const systemStatus = useMutation(api.initialization.getSystemStatus);
  
  useEffect(() => {
    const initSystem = async () => {
      try {
        const status = await systemStatus();
        if (!status.systemReady) {
          await initializeSystem();
          toast.success("System initialized successfully!");
        }
      } catch (error) {
        console.error("System initialization error:", error);
      }
    };
    
    initSystem();
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex">
          {[
            { id: 'log', label: '📝 Log Waste', icon: '📝' },
            { id: 'history', label: '📊 History', icon: '📊' },
            { id: 'profile', label: '👤 Profile', icon: '👤' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-green-600 text-green-600 bg-green-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'log' && <WasteLoggingForm />}
        {activeTab === 'history' && <WasteHistory />}
        {activeTab === 'profile' && <UserProfile />}
      </div>
    </div>
  );
}

function WasteLoggingForm() {
  const [wasteType, setWasteType] = useState('');
  const [unitName, setUnitName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const wasteTypes = useQuery(api.quantification.getAvailableWasteTypes);
  const availableUnits = useQuery(api.quantification.getAvailableUnits, 
    wasteType ? { wasteType } : "skip"
  );
  const logWaste = useMutation(api.wasteLogs.logWaste);
  const generateOpportunities = useAction(api.opportunities.generateOpportunities);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasteType || !unitName || !quantity) return;

    setIsLoading(true);
    try {
      const result = await logWaste({
        wasteType,
        unitName,
        quantity: parseInt(quantity),
      });

      toast.success(`Logged ${result.estimatedKg} kg of ${wasteType}!`);

      // Generate opportunities
      try {
        await generateOpportunities({ wasteLogId: result.wasteLogId });
        toast.success("Opportunities generated! Check your history.");
      } catch (error) {
        console.warn("Opportunities generation failed:", error);
      }

      // Reset form
      setWasteType('');
      setUnitName('');
      setQuantity('');
    } catch (error) {
      toast.error(`Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Log Your Agricultural Waste</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Waste Type
          </label>
          <select
            value={wasteType}
            onChange={(e) => {
              setWasteType(e.target.value);
              setUnitName(''); // Reset unit when waste type changes
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          >
            <option value="">Select waste type...</option>
            {wasteTypes?.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unit
          </label>
          <select
            value={unitName}
            onChange={(e) => setUnitName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            required
            disabled={!wasteType}
          >
            <option value="">Select unit...</option>
            {availableUnits?.map((unit) => (
              <option key={unit.unitName} value={unit.unitName}>
                {unit.unitName.replace(/_/g, ' ')} ({unit.avgKgPerUnit} kg each)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantity
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Enter quantity..."
            min="1"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !wasteType || !unitName || !quantity}
          className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Processing...' : 'Log Waste & Get Opportunities'}
        </button>
      </form>
    </div>
  );
}

function WasteHistory() {
  const wasteLogs = useQuery(api.wasteLogs.getUserWasteLogs, { limit: 20 });
  const wasteStats = useQuery(api.wasteLogs.getWasteStats);
  const opportunities = useQuery(api.opportunities.getUserOpportunities, { limit: 10 });

  if (!wasteLogs || !wasteStats) {
    return <div className="text-center">Loading history...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 p-4 rounded-lg">
          <h4 className="font-semibold text-green-800">Total Logs</h4>
          <p className="text-2xl font-bold text-green-600">{wasteStats.totalLogs}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-semibold text-blue-800">Total Weight</h4>
          <p className="text-2xl font-bold text-blue-600">{wasteStats.totalKg.toFixed(1)} kg</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <h4 className="font-semibold text-purple-800">Opportunities</h4>
          <p className="text-2xl font-bold text-purple-600">{opportunities?.length || 0}</p>
        </div>
      </div>

      {/* Recent Logs */}
      <div>
        <h4 className="font-semibold text-gray-800 mb-3">Recent Waste Logs</h4>
        <div className="space-y-2">
          {wasteLogs.slice(0, 5).map((log) => (
            <div key={log._id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <span className="font-medium">
                  {log.wasteType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
                <span className="text-gray-600 ml-2">
                  {log.quantity} {log.unitName.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="text-right">
                <div className="font-semibold text-green-600">{log.totalKg} kg</div>
                <div className="text-xs text-gray-500">
                  {new Date(log.timestamp).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Opportunities */}
      {opportunities && opportunities.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-3">Recent Opportunities</h4>
          <div className="space-y-3">
            {opportunities.slice(0, 3).map((opp) => (
              <div key={opp._id} className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                <div className="text-sm text-gray-600 mb-2">
                  Generated {new Date(opp.generatedAt).toLocaleDateString()}
                </div>
                <div className="text-sm whitespace-pre-line">
                  {opp.opportunitiesText.substring(0, 200)}...
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UserProfile() {
  const [region, setRegion] = useState('');
  const [farmSize, setFarmSize] = useState('');
  const [primaryCrops, setPrimaryCrops] = useState('');
  const [contactInfo, setContactInfo] = useState('');

  const userProfile = useQuery(api.userProfiles.getUserProfile);
  const availableRegions = useQuery(api.userProfiles.getAvailableRegions);
  const updateProfile = useMutation(api.userProfiles.createOrUpdateProfile);

  // Load existing profile data
  useEffect(() => {
    if (userProfile) {
      setRegion(userProfile.region || '');
      setFarmSize(userProfile.farmSize?.toString() || '');
      setPrimaryCrops(userProfile.primaryCrops?.join(', ') || '');
      setContactInfo(userProfile.contactInfo || '');
    }
  }, [userProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await updateProfile({
        region,
        farmSize: farmSize ? parseFloat(farmSize) : undefined,
        primaryCrops: primaryCrops ? primaryCrops.split(',').map(c => c.trim()) : undefined,
        contactInfo: contactInfo || undefined,
      });
      
      toast.success("Profile updated successfully!");
    } catch (error) {
      toast.error(`Error updating profile: ${error}`);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Your Profile</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Region *
          </label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          >
            <option value="">Select your region...</option>
            {availableRegions?.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Farm Size (acres)
          </label>
          <input
            type="number"
            value={farmSize}
            onChange={(e) => setFarmSize(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Enter farm size..."
            min="0"
            step="0.1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Primary Crops
          </label>
          <input
            type="text"
            value={primaryCrops}
            onChange={(e) => setPrimaryCrops(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="e.g., Rice, Wheat, Corn (comma separated)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contact Information
          </label>
          <input
            type="text"
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Phone number or email..."
          />
        </div>

        <button
          type="submit"
          className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
        >
          Update Profile
        </button>
      </form>
    </div>
  );
}
