import { useState, useEffect } from "react";
import { Bell, Droplet, Eye } from "lucide-react";
import { FaCamera } from "react-icons/fa";
import OpenAI from "openai";

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

const Dashboard = () => {
  const [soilData, setSoilData] = useState<SoilData>({
    nitrogen: 35,
    phosphorus: 42,
    potassium: 28,
    moisture: 65,
    timestamp: new Date().toLocaleTimeString(),
  });

  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);

  const [filterNotifications, setFilterNotifications] = useState<
    Notification[]
  >([]);

  const [availableDates, setAvailableDates] = useState<string[]>([]);

  const [selectedDate, setSelectedDate] = useState<string>("All");

  // Simulate receiving soil data
  useEffect(() => {
    const interval = setInterval(() => {
      const newData = {
        nitrogen: Math.max(
          10,
          Math.min(90, soilData.nitrogen + (Math.random() - 0.5) * 5)
        ),
        phosphorus: Math.max(
          10,
          Math.min(90, soilData.phosphorus + (Math.random() - 0.5) * 5)
        ),
        potassium: Math.max(
          10,
          Math.min(90, soilData.potassium + (Math.random() - 0.5) * 5)
        ),
        moisture: Math.max(
          10,
          Math.min(95, soilData.moisture + (Math.random() - 0.5) * 3)
        ),
        timestamp: new Date().toLocaleTimeString(),
      };

      setSoilData(newData);
    }, 3000);

    return () => clearInterval(interval);
  }, [soilData]);

  const addNotification = (
    message: string = "error",
    image: string = "/api/placeholder/320/240"
  ) => {
    const newNotification: Notification = {
      id: Math.random().toString(36).substring(7),
      message,
      timestamp: new Date(),
      image,
    };

    setNotifications((prev) => [newNotification, ...prev].slice(0, 10));
  };

  const handleScan = () => {
    addNotification();
  };

  useEffect(() => {
    const interval = setInterval(() => {
      handleScan();
    }, 2 * 60 * 60 * 1000); // 2 hours

    return () => clearInterval(interval);
  }, []);

  const formatValue = (value: number) => {
    let color = "text-green-500";
    if (value < 30) color = "text-red-500";
    else if (value < 50) color = "text-yellow-500";

    return <span className={color}>{value.toFixed(1)}</span>;
  };

  const captureImage = async (): Promise<string | null> => {
    try {
      // Fetch the image from the backend
      const response = await fetch("http://192.168.165.82:5000//capture_image");
      const blob = await response.blob();

      const base64 = await convertBlobToBase64(blob);

      return base64;
    } catch (error) {
      console.error("Error capturing image:", error);
      return null; // Return null in case of error
    }
  };

  const convertBlobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob); // This converts the blob to base64
    });
  };

  const fetchAiResponse = async (input: string) => {
    try {
      const openai = new OpenAI({
        apiKey: import.meta.env.VITE_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true,
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "check if mushroom is ready to harvest",
              },
              {
                type: "image_url",
                image_url: {
                  url: input,
                },
              },
            ],
          },
        ],
      });
      console.log(completion.choices[0].message.content);
      setAiResponse(completion.choices[0].message.content);
    } catch (error) {
      console.error("Error fetching aiResponse:", error);
    }
  };

  const handleCapture = async () => {
    const url = await captureImage();
    if (url) {
      fetchAiResponse(url);
      if (aiResponse) {
        addNotification(aiResponse, url);
      }
    }
    if (!url) {
      console.log("Failed to capture the image.");
    }
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setSelectedDate(selected);

    const filtered = notifications.filter(
      (notif) => formatDate(notif.timestamp) === selected
    );
    setFilterNotifications(filtered);
  };



  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-green-700 text-white p-4 shadow-md">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold"> Monitoring Dashboard</h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-col md:flex-row flex-1 p-4 gap-2">
        {/* Notifications Section */}
        <div className="md:w-2/5 bg-white rounded-lg shadow-md max-h-[700px] flex flex-col items-center p-5">
          <div className="p-3 bg-green-700 text-white font-semibold flex items-center justify-between w-full">
            <span className="flex items-center">
              <Eye className="mr-2" /> Live Camera Feed
            </span>
            <span className="bg-red-500 px-2 py-1 rounded-full text-xs animate-pulse">
              LIVE
            </span>
          </div>
          <div className="flex-1 flex items-center justify-center bg-green-100 w-full h-70 mb-4">
            <div className="relative h-full w-full rounded overflow-hidden">
              <img
                src="http://192.168.1.23:5000/video_feed"
                alt="Plant camera feed"
                className="w-full h-full object-cover -rotate-90"
              />
            </div>
          </div>
          <button
            onClick={handleScan}
            className="px-4 py-2 rounded bg-green-700 text-white font-semibold shadow-sm hover:bg-green-500 flex items-center mb-4 hover:scale-105 transition duration-300 ease-in-out"
          >
            Scan
            <FaCamera className="ml-2" />
          </button>
        </div>

        {/* Soil Data Section */}
        <div className="md:w-3/5 bg-white rounded-lg shadow-md p-4">
          <div className="mb-4">
            <label
              htmlFor="dateFilter"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Select Date:
            </label>
            <select
              id="dateFilter"
              value={selectedDate}
              onChange={handleDateChange}
              disabled={availableDates.length === 0}
              className="p-3 border border-gray-300 rounded-lg"
            >
              <option value={formatDate(new Date())}>
                {formatDate(new Date())}
              </option>
              {availableDates
                .filter((date) => date !== formatDate(new Date()))
                .map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
            </select>
          </div>

          <div className="w-full h-[180px] border border-gray-300 rounded-lg mb-3 p-2 overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Bell size={20} />
              Notifications
            </h2>
            {notifications.length === 0 ? (
              <div className="text-gray-500">No notifications yet.</div>
            ) : (
              filterNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-3 border-b border-gray-200"
                >
                  <p className="text-sm">{notification.message}</p>
                  <p className="text-xs text-gray-500">
                    {notification.timestamp.toLocaleTimeString()}
                  </p>
                  {notification.image && (
                    <img
                      src={notification.image}
                      alt="Notification"
                      className="mt-2 rounded-md w-full"
                    />
                  )}
                </div>
              ))
            )}
          </div>
          <h2 className="text-xl font-semibold mb-4">Soil Analysis</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-gray-700 mb-2">NPK Levels</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Nitrogen (N)</div>
                  <div className="text-xl font-bold">
                    {formatValue(soilData.nitrogen)}%
                  </div>
                  <div className="mt-2 bg-gray-200 h-2 rounded-full">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${soilData.nitrogen}%` }}
                    ></div>
                  </div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">
                    Phosphorus (P)
                  </div>
                  <div className="text-xl font-bold">
                    {formatValue(soilData.phosphorus)}%
                  </div>
                  <div className="mt-2 bg-gray-200 h-2 rounded-full">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${soilData.phosphorus}%` }}
                    ></div>
                  </div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">
                    Potassium (K)
                  </div>
                  <div className="text-xl font-bold">
                    {formatValue(soilData.potassium)}%
                  </div>
                  <div className="mt-2 bg-gray-200 h-2 rounded-full">
                    <div
                      className="bg-purple-500 h-2 rounded-full"
                      style={{ width: `${soilData.potassium}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center mb-2">
                <Droplet size={16} className="text-blue-500 mr-2" />
                <h3 className="font-medium text-gray-700">Soil Moisture</h3>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Current level</span>
                  <span
                    className={`font-bold ${
                      soilData.moisture < 30
                        ? "text-red-500"
                        : soilData.moisture < 50
                        ? "text-yellow-500"
                        : "text-green-500"
                    }`}
                  >
                    {soilData.moisture.toFixed(1)}%
                  </span>
                </div>
                <div className="bg-gray-200 h-4 rounded-full">
                  <div
                    className={`h-4 rounded-full ${
                      soilData.moisture < 30
                        ? "bg-red-500"
                        : soilData.moisture < 50
                        ? "bg-yellow-500"
                        : "bg-blue-500"
                    }`}
                    style={{ width: `${soilData.moisture}%` }}
                  ></div>
                </div>
              </div>
            </div>

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
};

export default Dashboard;
