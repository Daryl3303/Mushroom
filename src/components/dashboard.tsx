import { useState, useEffect } from "react";
import { Bell, Droplet, Eye, Loader2 } from "lucide-react";
import { FaCamera } from "react-icons/fa";
import { WiHumidity } from "react-icons/wi";
import { FaTemperatureHigh } from "react-icons/fa";
import OpenAI from "openai";
import { database } from "../config/firebase";
import {
  ref,
  onValue,
  push,
  set,
  query,
  orderByChild,
  get,
} from "firebase/database";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Type definitions
type NPKData = {
  nitrogen: string;
  phosphorus: string;
  potassium: string;
};

type SoilData = {
  npk: NPKData;
  ph: string;
  moistureSensor1: number;
  moistureSensor2: number;
  moistureSensor3: number;
  moisture: number;
  humidity: number;
  temperature: number;
  timestamp: string;
};

type ScanData = {
  timestamp: number;
  date: string;
  data: SoilData;
  image?: string;
  aiAnalysis?: string;
};

type Notification = {
  id: string;
  message: string;
  timestamp: Date;
  date: string;
  image?: string;
};

const Dashboard = () => {
  const [soilData, setSoilData] = useState<SoilData>({
    npk: {
      nitrogen: "0(0)",
      phosphorus: "0(0)",
      potassium: "0(0)",
    },
    ph: "0(0)",
    moistureSensor1: 0,
    moistureSensor2: 0,
    moistureSensor3: 0,
    moisture: 0,
    humidity: 0,
    temperature: 0,
    timestamp: new Date().toLocaleTimeString(),
  });

  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);

  const [filterNotifications, setFilterNotifications] = useState<
    Notification[]
  >([]);

  const [availableDates, setAvailableDates] = useState<string[]>([]);

  const [selectedDate, setSelectedDate] = useState<string>("All");

  const [isAutoScanEnabled, setIsAutoScanEnabled] = useState(false);
  const [nextScanTime, setNextScanTime] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);

  // Fetch real-time data from Firebase
  useEffect(() => {
    const sensorDataRef = ref(database, "sensor_data");

    const unsubscribe = onValue(sensorDataRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSoilData({
          npk: data.npk,
          ph: data.ph,
          moistureSensor1: data.soil_moisture.sensor1,
          moistureSensor2: data.soil_moisture.sensor2,
          moistureSensor3: data.soil_moisture.sensor3,
          moisture: data.soil_moisture.average,
          humidity: data.humidity,
          temperature: data.temperature,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const addNotification = (
    message: string = "error",
    image: string = "/api/placeholder/320/240"
  ) => {
    const newNotification: Notification = {
      id: Math.random().toString(36).substring(7),
      message,
      timestamp: new Date(),
      date: new Date().toISOString().split("T")[0],
      image,
    };

    setNotifications((prev) => [newNotification, ...prev].slice(0, 10));
  };

  const storeScanData = async (
    data: SoilData,
    image?: string,
    aiAnalysis?: string
  ) => {
    try {
      const scanRef = ref(database, "scan_history");
      const newScanRef = push(scanRef);

      const scanData: ScanData = {
        timestamp: Date.now(),
        date: new Date().toISOString().split("T")[0],
        data: data,
        image: image,
        aiAnalysis: aiAnalysis,
      };

      await set(newScanRef, scanData);

      // Add notification with AI analysis
      if (aiAnalysis) {
        addNotification(aiAnalysis, image);
      }
    } catch (error) {
      console.error("Error storing scan data:", error);
      addNotification("Error storing scan data");
    }
  };

  const fetchAiResponse = async (input: string) => {
    try {
      const openai = new OpenAI({
        apiKey: import.meta.env.VITE_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true,
      });

      // Parse the input if it's a JSON string
      let base64Data;
      try {
        const jsonData = JSON.parse(input);
        if (jsonData.format === "base64" && jsonData.image) {
          base64Data = `data:image/jpeg;base64,${jsonData.image}`;
        } else {
          base64Data = input.startsWith("data:image")
            ? input
            : `data:image/jpeg;base64,${input}`;
        }
      } catch (e) {
        // If parsing fails, assume input is direct base64
        base64Data = input.startsWith("data:image")
          ? input
          : `data:image/jpeg;base64,${input}`;
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this oyster mushroom image and provide the following information in a structured format:\n1. Growth Stage (initial, mid-stage, or growth stage)\n2. Harvest Readiness (yes/no)\nFormat the response as:\nGROWTH_STAGE: [stage]\nHARVEST_READY: [yes/no]",
              },
              {
                type: "image_url",
                image_url: {
                  url: base64Data,
                },
              },
            ],
          },
        ],
        max_tokens: 300,
      });

      const response = completion.choices[0].message.content;
      setAiResponse(response);
      return response;
    } catch (error) {
      console.error("Error fetching aiResponse:", error);
      return null;
    }
  };

  const handleScan = async () => {
    try {
      setIsScanning(true);
      const url = await captureImage();
      if (url) {
        const aiAnalysis = await fetchAiResponse(url);
        await storeScanData(soilData, url, aiAnalysis || undefined);
        toast.success("Scan completed successfully!", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      } else {
        console.log("Failed to capture the image.");
        toast.error("Failed to capture image", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (error) {
      console.error("Error during scan:", error);
      toast.error("Error during scan", {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setSelectedDate(selected);

    const filtered = notifications.filter((notif) => notif.date === selected);
    setFilterNotifications(filtered);
  };

  // Load scan history
  useEffect(() => {
    const loadScanHistory = async () => {
      try {
        const scanRef = query(
          ref(database, "scan_history"),
          orderByChild("timestamp")
        );
        const unsubscribe = onValue(scanRef, (snapshot) => {
          const dates = new Set<string>();
          const newNotifications: Notification[] = [];

          snapshot.forEach((child) => {
            const scanData: ScanData = child.val();
            dates.add(scanData.date);

            // Parse the image data if it exists
            let imageUrl = "";
            if (scanData.image) {
              try {
                const imageData = JSON.parse(scanData.image);
                if (imageData.format === "base64" && imageData.image) {
                  imageUrl = `data:image/jpeg;base64,${imageData.image}`;
                }
              } catch (e) {
                console.error("Error parsing image data:", e);
              }
            }

            // Create notification message combining AI analysis and sensor data
            const message = scanData.aiAnalysis
              ? `${scanData.aiAnalysis}\n\nSensor Data:\nNPK: N(${scanData.data.npk.nitrogen}) P(${scanData.data.npk.phosphorus}) K(${scanData.data.npk.potassium})\npH: ${scanData.data.ph}\nMoisture: ${scanData.data.moisture}% (S1: ${scanData.data.moistureSensor1}%, S2: ${scanData.data.moistureSensor2}%, S3: ${scanData.data.moistureSensor3}%)\nTemperature: ${scanData.data.temperature}°C\nHumidity: ${scanData.data.humidity}%`
              : `Scan Results:\nNPK: N(${scanData.data.npk.nitrogen}) P(${scanData.data.npk.phosphorus}) K(${scanData.data.npk.potassium})\npH: ${scanData.data.ph}\nMoisture: ${scanData.data.moisture}% (S1: ${scanData.data.moistureSensor1}%, S2: ${scanData.data.moistureSensor2}%, S3: ${scanData.data.moistureSensor3}%)\nTemperature: ${scanData.data.temperature}°C\nHumidity: ${scanData.data.humidity}%`;

            newNotifications.push({
              id: child.key || "",
              message: message,
              timestamp: new Date(scanData.timestamp),
              date: scanData.date,
              image: imageUrl,
            });
          });

          // Sort notifications by timestamp (newest first)
          const sortedNotifications = newNotifications.sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

          const sortedDates = Array.from(dates).sort().reverse();
          setAvailableDates(sortedDates);
          setNotifications(sortedNotifications);

          // Set initial filtered notifications for the most recent date
          if (sortedDates.length > 0) {
            setSelectedDate(sortedDates[0]);
            const filtered = sortedNotifications.filter(
              (notif) => notif.date === sortedDates[0]
            );
            setFilterNotifications(filtered);
          }
        });

        return () => unsubscribe();
      } catch (error) {
        console.error("Error loading scan history:", error);
      }
    };

    loadScanHistory();
  }, []);

  const formatNPKValue = (value: string) => {
    const [processed, raw] = value.split("(");
    const processedValue = parseFloat(processed);
    const rawValue = raw ? parseFloat(raw.replace(")", "")) : 0;

    let color = "text-green-500";
    if (processedValue < 30) color = "text-red-500";
    else if (processedValue < 50) color = "text-yellow-500";

    return (
      <span className={color}>
        {processedValue.toFixed(1)}
        <span className="text-gray-500 text-sm ml-1">
          ({rawValue.toFixed(1)})
        </span>
      </span>
    );
  };

  const captureImage = async (): Promise<string | null> => {
    try {
      // Fetch the image from the backend
      const response = await fetch(
        "http://192.168.100.192:5000//capture_image"
      );
      const base64Data = await response.text(); // Get the base64 string directly
      return base64Data;
    } catch (error) {
      console.error("Error capturing image:", error);
      return null; // Return null in case of error
    }
  };

  const handleCapture = async () => {
    try {
      setIsScanning(true);
      const url = await captureImage();
      if (url) {
        const aiAnalysis = await fetchAiResponse(url);
        await storeScanData(soilData, url, aiAnalysis || undefined);
        toast.success("Capture completed successfully!", {
          position: "top-right",
          autoClose: 3000,
        });
      }
      if (!url) {
        console.log("Failed to capture the image.");
        toast.error("Failed to capture image", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (error) {
      toast.error("Error during capture", {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setIsScanning(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  const getProcessedValue = (value: string) => {
    return parseFloat(value.split("(")[0]);
  };

  // Toggle auto scan
  const toggleAutoScan = () => {
    const newState = !isAutoScanEnabled;
    setIsAutoScanEnabled(newState);

    if (newState) {
      // Set initial next scan time when enabling auto-scan
      const nextScan = new Date();
      nextScan.setHours(nextScan.getHours() + 1);
      setNextScanTime(nextScan);
      setTimeRemaining("1h 0m 0s"); // Set initial time remaining
    } else {
      setNextScanTime(null);
      setTimeRemaining("");
    }
  };

  // Auto scan function
  const startAutoScan = () => {
    if (!isAutoScanEnabled) return;

    const performScan = async () => {
      try {
        setIsScanning(true);
        const url = await captureImage();
        if (url) {
          const aiAnalysis = await fetchAiResponse(url);
          await storeScanData(soilData, url, aiAnalysis || undefined);
          toast.success("Auto scan completed successfully!", {
            position: "top-right",
            autoClose: 3000,
          });
        }
      } catch (error) {
        console.error("Error during auto scan:", error);
        toast.error("Error during auto scan", {
          position: "top-right",
          autoClose: 3000,
        });
      } finally {
        setIsScanning(false);
      }
    };

    // Perform initial scan
    performScan();

    // Set up interval for every 2 hours
    const intervalId = setInterval(() => {
      performScan();
      // Update next scan time after interval
      const nextScan = new Date();
      nextScan.setHours(nextScan.getHours() + 2);
      setNextScanTime(nextScan);
    }, 1 * 60 * 60 * 1000); // 2 hours in milliseconds

    // Cleanup function
    return () => {
      clearInterval(intervalId);
      setNextScanTime(null);
      setTimeRemaining("");
    };
  };

  // Update timer every second
  useEffect(() => {
    if (!isAutoScanEnabled || !nextScanTime) return;

    const updateTimer = () => {
      const now = new Date();
      const diff = nextScanTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("Scanning...");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
    };

    // Update immediately
    updateTimer();

    // Update every second
    const timerId = setInterval(updateTimer, 1000);

    return () => {
      clearInterval(timerId);
    };
  }, [isAutoScanEnabled, nextScanTime]);

  // Effect to handle auto scan
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (isAutoScanEnabled) {
      cleanup = startAutoScan();
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, [isAutoScanEnabled]); // Removed soilData dependency to prevent unnecessary re-renders

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <ToastContainer />
      {/* Header */}
      <header className="bg-green-700 text-white p-4 shadow-md">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold"> Monitoring Dashboard</h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-col md:flex-row flex-1 p-4 gap-2">
        {/* Notifications Section */}
        <div className="md:w-2/6 bg-white rounded-lg shadow-md max-h-[650px] flex flex-col items-center p-5">
          <div className="p-3 bg-green-700 text-white font-semibold flex items-center justify-between w-full">
            <span className="flex items-center">
              <Eye className="mr-2" /> Live Camera Feed
            </span>
            <span className="bg-red-500 px-2 py-1 rounded-full text-xs animate-pulse">
              LIVE
            </span>
          </div>
          <div className="flex items-center justify-center bg-green-100 w-full h-[400px] mb-4">
            <div className="relative h-full w-full rounded overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center rotate-90">
                <img
                  src="http://192.168.100.192:5000/video"
                  alt="Plant camera feed"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-4 w-full">
            <button
              onClick={handleScan}
              disabled={isScanning}
              className={`px-4 py-2 rounded bg-green-700 text-white font-semibold shadow-sm hover:bg-green-500 flex items-center justify-center hover:scale-105 transition duration-300 ease-in-out h-[50px] w-full ${
                isScanning ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isScanning ? (
                <>
                  <Loader2 className="animate-spin mr-2" />
                  Scanning...
                </>
              ) : (
                <>
                  Scan Now
                  <FaCamera className="ml-2" />
                </>
              )}
            </button>

            <div className="flex items-center justify-between w-full bg-gray-50 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoScan"
                  checked={isAutoScanEnabled}
                  onChange={toggleAutoScan}
                  className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                />
                <label
                  htmlFor="autoScan"
                  className="text-sm font-medium text-gray-700"
                >
                  Auto Scan (Every 1 hour)
                </label>
              </div>
              {isAutoScanEnabled && timeRemaining && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Next scan in:</span>
                  <span className="text-sm font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                    {timeRemaining}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Soil Data Section */}
        <div className="md:w-2/6 bg-white rounded-lg shadow-md p-4">
          <h2 className="text-xl font-semibold mb-4">Soil Analysis</h2>
          <div className="space-y-6 ">
            <div>
              <h3 className="font-medium text-gray-700 mb-2">NPK Levels</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Nitrogen (N)</div>
                  <div className="text-xl font-bold">
                    {formatNPKValue(soilData.npk.nitrogen)}
                  </div>
                  <div className="mt-2 bg-gray-200 h-2 rounded-full">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{
                        width: `${getProcessedValue(soilData.npk.nitrogen)}%`,
                      }}
                    ></div>
                  </div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">
                    Phosphorus (P)
                  </div>
                  <div className="text-xl font-bold">
                    {formatNPKValue(soilData.npk.phosphorus)}
                  </div>
                  <div className="mt-2 bg-gray-200 h-2 rounded-full">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{
                        width: `${getProcessedValue(soilData.npk.phosphorus)}%`,
                      }}
                    ></div>
                  </div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">
                    Potassium (K)
                  </div>
                  <div className="text-xl font-bold">
                    {formatNPKValue(soilData.npk.potassium)}
                  </div>
                  <div className="mt-2 bg-gray-200 h-2 rounded-full">
                    <div
                      className="bg-purple-500 h-2 rounded-full"
                      style={{
                        width: `${getProcessedValue(soilData.npk.potassium)}%`,
                      }}
                    ></div>
                  </div>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">pH</div>
                  <div className="text-xl font-bold">
                    {formatNPKValue(soilData.ph)}
                  </div>
                  <div className="mt-2 bg-gray-200 h-2 rounded-full">
                    <div
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{ width: `${getProcessedValue(soilData.ph)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center mb-2">
                <h3 className="font-medium text-gray-700">Soil Moisture</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex justify-between mb-2">
                      <div className="flex items-center mb-2">
                        <small className="text-gray-700">Sensor 1</small>
                      </div>
                      <span
                        className={`font-bold ${
                          soilData.moistureSensor1 < 30
                            ? "text-red-500"
                            : soilData.moisture < 50
                            ? "text-yellow-500"
                            : "text-green-500"
                        }`}
                      >
                        {soilData.moistureSensor1.toFixed(1)}%
                      </span>
                    </div>
                    <div className="bg-gray-200 h-4 rounded-full">
                      <div
                        className={`h-4 rounded-full ${
                          soilData.moistureSensor1 < 30
                            ? "bg-red-500"
                            : soilData.moistureSensor1 < 50
                            ? "bg-yellow-500"
                            : "bg-blue-500"
                        }`}
                        style={{ width: `${soilData.moistureSensor1}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex justify-between mb-2">
                      <div className="flex items-center mb-2">
                        <small className="text-gray-700">Sensor 2</small>
                      </div>
                      <span
                        className={`font-bold ${
                          soilData.moistureSensor2 < 30
                            ? "text-red-500"
                            : soilData.moistureSensor2 < 50
                            ? "text-yellow-500"
                            : "text-green-500"
                        }`}
                      >
                        {soilData.moistureSensor2.toFixed(1)}%
                      </span>
                    </div>
                    <div className="bg-gray-200 h-4 rounded-full">
                      <div
                        className={`h-4 rounded-full ${
                          soilData.moistureSensor2 < 30
                            ? "bg-red-500"
                            : soilData.moistureSensor2 < 50
                            ? "bg-yellow-500"
                            : "bg-blue-500"
                        }`}
                        style={{ width: `${soilData.moistureSensor2}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex justify-between mb-2">
                      <div className="flex items-center mb-2">
                        <small className="text-gray-700">Sensor 1</small>
                      </div>
                      <span
                        className={`font-bold ${
                          soilData.moistureSensor3 < 30
                            ? "text-red-500"
                            : soilData.moistureSensor3 < 50
                            ? "text-yellow-500"
                            : "text-green-500"
                        }`}
                      >
                        {soilData.moistureSensor3.toFixed(1)}%
                      </span>
                    </div>
                    <div className="bg-gray-200 h-4 rounded-full">
                      <div
                        className={`h-4 rounded-full ${
                          soilData.moistureSensor3 < 30
                            ? "bg-red-500"
                            : soilData.moistureSensor3 < 50
                            ? "bg-yellow-500"
                            : "bg-blue-500"
                        }`}
                        style={{ width: `${soilData.moistureSensor3}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center mb-2">
                <Droplet size={16} className="text-blue-500 mr-2" />
                <h3 className="font-medium text-gray-700">
                  Soil Moisture Total Average
                </h3>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center mb-2">
                    <WiHumidity size={25} className="text-blue-500 mr-2" />
                    <h3 className="font-medium text-gray-700">Humidity</h3>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex justify-between mb-2">
                      <span
                        className={`font-bold ${
                          soilData.humidity < 30
                            ? "text-red-500"
                            : soilData.humidity < 50
                            ? "text-yellow-500"
                            : "text-green-500"
                        }`}
                      >
                        {soilData.humidity.toFixed(1)}%
                      </span>
                    </div>
                    <div className="bg-gray-200 h-4 rounded-full">
                      <div
                        className={`h-4 rounded-full ${
                          soilData.humidity < 30
                            ? "bg-red-500"
                            : soilData.humidity < 50
                            ? "bg-yellow-500"
                            : "bg-blue-500"
                        }`}
                        style={{ width: `${soilData.humidity}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center mb-2">
                    <FaTemperatureHigh
                      size={20}
                      className="text-red-500 mr-2"
                    />
                    <h3 className="font-medium text-gray-700">Temperature</h3>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="flex justify-between mb-2">
                      <span
                        className={`font-bold ${
                          soilData.temperature < 15
                            ? "text-blue-500"
                            : soilData.temperature > 30
                            ? "text-red-500"
                            : "text-green-500"
                        }`}
                      >
                        {soilData.temperature.toFixed(1)}°C
                      </span>
                    </div>
                    <div className="bg-gray-200 h-4 rounded-full">
                      <div
                        className={`h-4 rounded-full ${
                          soilData.temperature < 15
                            ? "bg-blue-500"
                            : soilData.temperature > 30
                            ? "bg-red-500"
                            : "bg-green-500"
                        }`}
                        style={{
                          width: `${Math.min(
                            Math.max(soilData.temperature, 0),
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
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

        <div className="md:w-2/6 bg-white rounded-lg shadow-md p-4">
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
              {availableDates.map((date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col h-[calc(100vh-250px)]">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Bell size={20} />
              Notifications
            </h2>
            <div className="flex-1 overflow-y-auto pr-2">
              {notifications.length === 0 ? (
                <div className="text-gray-500">No scan history yet.</div>
              ) : (
                filterNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      {notification.image && (
                        <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden shadow-sm">
                          <img
                            src={notification.image}
                            alt="Scan"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-grow min-w-0">
                        <div className="flex justify-between items-start mb-2">
                          <div className="text-xs text-gray-500 font-medium">
                            {notification.timestamp.toLocaleDateString()} at{" "}
                            {notification.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-sm">
                          <div className="space-y-2">
                            {notification.message
                              .split("\n")
                              .map((line, index) => (
                                <div key={index} className="flex items-center">
                                  {line.startsWith("GROWTH_STAGE:") && (
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-gray-700">
                                        Growth Stage:
                                      </span>
                                      <span
                                        className={`px-3 py-1 rounded-full text-sm ${
                                          line.includes("initial")
                                            ? "bg-blue-50 text-blue-600"
                                            : line.includes("mid-stage")
                                            ? "bg-yellow-50 text-yellow-600"
                                            : "bg-green-50 text-green-600"
                                        }`}
                                      >
                                        {line.split(":")[1].trim()}
                                      </span>
                                    </div>
                                  )}
                                  {line.startsWith("HARVEST_READY:") && (
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-gray-700">
                                        Harvest Ready:
                                      </span>
                                      <span
                                        className={`px-3 py-1 rounded-full text-sm ${
                                          line.includes("yes")
                                            ? "bg-green-50 text-green-600"
                                            : "bg-red-50 text-red-600"
                                        }`}
                                      >
                                        {line.split(":")[1].trim()}
                                      </span>
                                    </div>
                                  )}
                                  {line.startsWith("EXPLANATION:") && (
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-gray-700">
                                        Analysis:
                                      </span>
                                      <span className="text-sm text-gray-600">
                                        {line.split(":")[1].trim()}
                                      </span>
                                    </div>
                                  )}
                                  {line.includes("NPK:") && (
                                    <div className="flex-grow">
                                      <span className="font-medium text-gray-700">
                                        NPK Levels:
                                      </span>
                                      <div className="grid grid-cols-3 gap-2 mt-1">
                                        {line.match(/N\((.*?)\)/)?.[1] && (
                                          <div className="bg-green-50 p-2 rounded">
                                            <span className="text-xs text-gray-600">
                                              N
                                            </span>
                                            <div className="font-medium">
                                              {line.match(/N\((.*?)\)/)?.[1]}
                                            </div>
                                          </div>
                                        )}
                                        {line.match(/P\((.*?)\)/)?.[1] && (
                                          <div className="bg-blue-50 p-2 rounded">
                                            <span className="text-xs text-gray-600">
                                              P
                                            </span>
                                            <div className="font-medium">
                                              {line.match(/P\((.*?)\)/)?.[1]}
                                            </div>
                                          </div>
                                        )}
                                        {line.match(/K\((.*?)\)/)?.[1] && (
                                          <div className="bg-purple-50 p-2 rounded">
                                            <span className="text-xs text-gray-600">
                                              K
                                            </span>
                                            <div className="font-medium">
                                              {line.match(/K\((.*?)\)/)?.[1]}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {line.includes("pH:") && (
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-gray-700">
                                        pH:
                                      </span>
                                      <span className="bg-yellow-50 px-3 py-1 rounded-full text-sm">
                                        {line.match(/pH: (.*)/)?.[1]}
                                      </span>
                                    </div>
                                  )}
                                  {line.includes("Moisture:") && (
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-gray-700">
                                        Moisture:
                                      </span>
                                      <span className="bg-blue-50 px-3 py-1 rounded-full text-sm">
                                        {line.match(/Moisture: (.*?)%/)?.[1]}%
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        (S1: {line.match(/S1: (.*?)%/)?.[1]}%,
                                        S2: {line.match(/S2: (.*?)%/)?.[1]}%,
                                        S3: {line.match(/S3: (.*?)%/)?.[1]}%)
                                      </span>
                                    </div>
                                  )}
                                  {line.includes("Temperature:") && (
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-gray-700">
                                        Temperature:
                                      </span>
                                      <span className="bg-red-50 px-3 py-1 rounded-full text-sm">
                                        {
                                          line.match(
                                            /Temperature: (.*?)°C/
                                          )?.[1]
                                        }
                                        °C
                                      </span>
                                    </div>
                                  )}
                                  {line.includes("Humidity:") && (
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-gray-700">
                                        Humidity:
                                      </span>
                                      <span className="bg-blue-50 px-3 py-1 rounded-full text-sm">
                                        {line.match(/Humidity: (.*?)%/)?.[1]}%
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-white p-2 text-center text-sm">
        Mushroom Monitoring System © {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default Dashboard;
