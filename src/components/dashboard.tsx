import { useState, useEffect } from "react";
import { Bell, Camera, Droplet} from "lucide-react";

// Type definitions
type SoilData = {
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  moisture: number;
  timestamp: string;
};

type Notification = {
  id: string;
  message: string;
  timestamp: Date;
  image?: string;
};

function Dashboard() {
  const [soilData, setSoilData] = useState<SoilData>({
    nitrogen: 35,
    phosphorus: 42,
    potassium: 28,
    moisture: 65,
    timestamp: new Date().toLocaleTimeString(),
  });
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const [showNotifications, setShowNotifications] = useState(false);
  // Simulate receiving soil data
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate data fluctuation with random adjustments
      const newData = {
        nitrogen: Math.max(10, Math.min(90, soilData.nitrogen + (Math.random() - 0.5) * 5)),
        phosphorus: Math.max(10, Math.min(90, soilData.phosphorus + (Math.random() - 0.5) * 5)),
        potassium: Math.max(10, Math.min(90, soilData.potassium + (Math.random() - 0.5) * 5)),
        moisture: Math.max(10, Math.min(95, soilData.moisture + (Math.random() - 0.5) * 3)),
        timestamp: new Date().toLocaleTimeString(),
      };
      
      setSoilData(newData);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [soilData]);
  
  const addNotification = (message: string, image: string = "/api/placeholder/320/240") => {
    const newNotification: Notification = {
      id: Math.random().toString(36).substring(7),
      message,
      timestamp: new Date(),
      image
    };
    
    setNotifications(prev => [newNotification, ...prev].slice(0, 10));
  };
  
  // Handle scan button click
  const handleScan = () => {
    const soilStatus = `N: ${soilData.nitrogen.toFixed(1)}%, P: ${soilData.phosphorus.toFixed(1)}%, K: ${soilData.potassium.toFixed(1)}%, Moisture: ${soilData.moisture.toFixed(1)}%`;
    addNotification(`Soil scan complete: ${soilStatus}`);
  };
  
  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };
  
  // Format soil data value with color coding
  const formatValue = (value: number) => {
    let color = "text-green-500";
    if (value < 30) color = "text-red-500";
    else if (value < 50) color = "text-yellow-500";
    
    return <span className={color}>{value.toFixed(1)}</span>;
  };
  
  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-green-700 text-white p-4 shadow-md">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Soil Monitoring Dashboard</h1>
          <div className="relative">
            <button 
              onClick={toggleNotifications}
              className="p-2 rounded-full hover:bg-green-600 focus:outline-none"
            >
              <Bell size={24} />
              {notifications.length > 0 && (
                <span className="absolute top-0 right-0 px-2 py-1 text-xs rounded-full bg-blue-500">
                  {notifications.length}
                </span>
              )}
            </button>
            
            {/* Notification dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg z-10 max-h-96 overflow-y-auto">
                <div className="p-2 border-b border-gray-200 font-semibold">
                  Notifications
                </div>
                {notifications.length === 0 ? (
                  <div className="p-4 text-gray-500">No notifications</div>
                ) : (
                  notifications.map(notification => (
                    <div 
                      key={notification.id} 
                      className="p-3 border-b border-gray-100 bg-white"
                    >
                      <div className="flex flex-col">
                        <div className="mb-2">
                          <p className="text-sm">{notification.message}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {notification.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                        {notification.image && (
                          <div className="mt-2 rounded overflow-hidden">
                            <img 
                              src={notification.image} 
                              alt="Captured soil image" 
                              className="w-full h-auto"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex flex-col md:flex-row flex-1 p-4">
        {/* Camera Feed */}
        <div className="md:w-3/5 bg-white rounded-lg shadow-md p-4 mr-0 md:mr-4 mb-4 md:mb-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Live Camera Feed</h2>
            <button 
              onClick={handleScan}
              className="px-3 py-1 rounded bg-green-500 text-white flex items-center"
            >
              <Camera size={16} className="mr-1" />
              Scan
            </button>
          </div>
          
          <div className="bg-black h-64 md:h-96 rounded-md flex items-center justify-center">
            <div className="relative w-full h-full overflow-hidden">
              <img 
                src="/api/placeholder/640/480"  
                alt="Live soil camera feed"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 right-4 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-sm">
                LIVE
              </div>
              <div className="absolute top-4 left-4 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-sm">
                {soilData.timestamp}
              </div>
            </div>
          </div>
        </div>
        
        {/* Soil Data */}
        <div className="md:w-2/5 bg-white rounded-lg shadow-md p-4">
          <h2 className="text-xl font-semibold mb-4">Soil Analysis</h2>
          
          <div className="space-y-6">
            {/* NPK Levels */}
            <div>
              <h3 className="font-medium text-gray-700 mb-2">NPK Levels</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Nitrogen (N)</div>
                  <div className="text-xl font-bold">{formatValue(soilData.nitrogen)}%</div>
                  <div className="mt-2 bg-gray-200 h-2 rounded-full">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${soilData.nitrogen}%` }}
                    ></div>
                  </div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Phosphorus (P)</div>
                  <div className="text-xl font-bold">{formatValue(soilData.phosphorus)}%</div>
                  <div className="mt-2 bg-gray-200 h-2 rounded-full">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${soilData.phosphorus}%` }}
                    ></div>
                  </div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Potassium (K)</div>
                  <div className="text-xl font-bold">{formatValue(soilData.potassium)}%</div>
                  <div className="mt-2 bg-gray-200 h-2 rounded-full">
                    <div 
                      className="bg-purple-500 h-2 rounded-full" 
                      style={{ width: `${soilData.potassium}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Moisture Level */}
            <div>
              <div className="flex items-center mb-2">
                <Droplet size={16} className="text-blue-500 mr-2" />
                <h3 className="font-medium text-gray-700">Soil Moisture</h3>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Current level</span>
                  <span className={`font-bold ${
                    soilData.moisture < 30 ? 'text-red-500' : 
                    soilData.moisture < 50 ? 'text-yellow-500' : 'text-green-500'
                  }`}>{soilData.moisture.toFixed(1)}%</span>
                </div>
                <div className="bg-gray-200 h-4 rounded-full">
                  <div 
                    className={`h-4 rounded-full ${
                      soilData.moisture < 30 ? 'bg-red-500' : 
                      soilData.moisture < 50 ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${soilData.moisture}%` }}
                  ></div>
                </div>
              </div>
            </div>
            
            {/* Last Reading */}
            <div className="border-t pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Last updated:</span>
                <span className="font-medium">{soilData.timestamp}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="bg-gray-800 text-white p-2 text-center text-sm">
        Soil Monitoring System © {new Date().getFullYear()}
      </footer>
    </div>
  );
}

export default Dashboard;