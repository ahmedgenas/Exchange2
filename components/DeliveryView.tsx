
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { RequestStatus } from '../types';
import { MapPin, CheckSquare, Package, PlayCircle, Navigation, ArrowRight, AlertTriangle, Clock, Milestone, Map as MapIcon, List, Snowflake } from 'lucide-react';
import * as L from 'leaflet';

const DeliveryView: React.FC = () => {
  const { currentUser, requests, branches, products, confirmPickup, completeDelivery, updateUserLocation } = useStore();
  const [confirmAction, setConfirmAction] = useState<{ taskId: string, type: 'PICKUP' | 'DELIVER' } | null>(null);
  const [viewMode, setViewMode] = useState<'LIST' | 'MAP'>('LIST');
  
  // GPS State
  const [driverLocation, setDriverLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeLineRef = useRef<L.Polyline | null>(null);

  if (!currentUser) return null;

  // 1. Tasks to Pickup (Assigned, but not yet picked up)
  const pickupTasks = requests.filter(r => r.driverId === currentUser.id && r.status === RequestStatus.ASSIGNED);
  
  // 2. Tasks In Transit (Picked up, need delivery)
  const deliveryTasks = requests.filter(r => r.driverId === currentUser.id && r.status === RequestStatus.PICKED_UP);

  // Combine for Map View
  const activeTasks = [...pickupTasks, ...deliveryTasks];
  const activeTarget = activeTasks.length > 0 ? activeTasks[0] : null;

  // Helper to calculate distance in KM
  const getDistanceKm = (loc1: {lat: number, lng: number}, loc2: {lat: number, lng: number}) => {
    if (!loc1 || !loc2) return 0;
    const R = 6371; // Radius of the earth in km
    const dLat = (loc2.lat - loc1.lat) * (Math.PI / 180);
    const dLon = (loc2.lng - loc1.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(loc1.lat * (Math.PI / 180)) * Math.cos(loc2.lat * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  };

  // --- Geolocation Effect ---
  useEffect(() => {
      if (!navigator.geolocation) {
          setLocationError("المتصفح لا يدعم تحديد الموقع الجغرافي");
          return;
      }

      const watchId = navigator.geolocation.watchPosition(
          (position) => {
              const { latitude, longitude } = position.coords;
              setDriverLocation({ lat: latitude, lng: longitude });
              setLocationError(null);
              updateUserLocation(latitude, longitude); // NEW: Update global state for admin/dist tracking
              
              // Update Map Marker for Driver if map exists
              if (viewMode === 'MAP' && mapRef.current) {
                  // We handle map updates in the Map Effect
              }
          },
          (error) => {
              console.error("Geolocation Error:", error.message);
              let msg = "تعذر تحديد الموقع.";
              switch(error.code) {
                  case 1: msg = "تم رفض إذن الوصول للموقع. يرجى تفعيله من إعدادات المتصفح."; break; // PERMISSION_DENIED
                  case 2: msg = "الموقع غير متاح حالياً. (GPS Weak)"; break; // POSITION_UNAVAILABLE
                  case 3: msg = "انتهت مهلة تحديد الموقع."; break; // TIMEOUT
              }
              setLocationError(msg);
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
  }, [viewMode]);

  // --- Map Initialization Effect ---
  useEffect(() => {
      if (viewMode === 'MAP') {
          // Small delay to ensure DOM is ready
          setTimeout(() => {
            if (!document.getElementById('map-container')) return;
            if (mapRef.current) return; // Already initialized

            const initialLat = driverLocation ? driverLocation.lat : 30.0444;
            const initialLng = driverLocation ? driverLocation.lng : 31.2357;

            const map = L.map('map-container').setView([initialLat, initialLng], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            mapRef.current = map;
          }, 100);
      } else {
          // Cleanup map when switching away
          if (mapRef.current) {
              mapRef.current.remove();
              mapRef.current = null;
              markersRef.current = [];
              routeLineRef.current = null;
          }
      }
  }, [viewMode]);

  // --- Map Update Effect (Markers & Routing) ---
  useEffect(() => {
      if (viewMode !== 'MAP' || !mapRef.current) return;

      const map = mapRef.current;

      // Clear existing layers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (routeLineRef.current) {
          routeLineRef.current.remove();
          routeLineRef.current = null;
      }

      // 1. Add Driver Marker
      if (driverLocation) {
          const driverIcon = L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color:#ea580c; width:30px; height:30px; border-radius:50%; border:3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:white;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg></div>`,
              iconSize: [30, 30],
              iconAnchor: [15, 15]
          });
          
          const marker = L.marker([driverLocation.lat, driverLocation.lng], { icon: driverIcon })
              .addTo(map)
              .bindPopup("<b>موقعك الحالي</b>");
          markersRef.current.push(marker);
      }

      // 2. Add Target Marker (Pickup or Delivery)
      if (activeTarget) {
          let targetLat = 0, targetLng = 0, label = '', color = '';
          
          if (activeTarget.status === RequestStatus.ASSIGNED) {
              // Target is Source Branch (Pickup)
              const b = branches.find(br => br.id === activeTarget.targetBranchId);
              if (b && b.location) {
                  targetLat = b.location.lat;
                  targetLng = b.location.lng;
                  label = `استلام: ${b.name}`;
                  color = '#f97316'; // Orange
              }
          } else {
              // Target is Requester Branch (Deliver)
              const b = branches.find(br => br.id === activeTarget.requesterBranchId);
              if (b && b.location) {
                  targetLat = b.location.lat;
                  targetLng = b.location.lng;
                  label = `تسليم: ${b.name}`;
                  color = '#2563eb'; // Blue
              }
          }

          if (targetLat && targetLng) {
               const targetIcon = L.divIcon({
                  className: 'custom-div-icon',
                  html: `<div style="background-color:${color}; width:30px; height:30px; border-radius:50%; border:3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:white;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
                  iconSize: [30, 30],
                  iconAnchor: [15, 30]
              });

              const destMarker = L.marker([targetLat, targetLng], { icon: targetIcon })
                .addTo(map)
                .bindPopup(`<b>${label}</b>`)
                .openPopup();
              markersRef.current.push(destMarker);

              // Draw Line
              if (driverLocation) {
                  const line = L.polyline([
                      [driverLocation.lat, driverLocation.lng],
                      [targetLat, targetLng]
                  ], { color: color, weight: 4, opacity: 0.7, dashArray: '10, 10' }).addTo(map);
                  routeLineRef.current = line;
                  
                  // Fit bounds to show both
                  map.fitBounds(line.getBounds(), { padding: [50, 50] });
              } else {
                  map.setView([targetLat, targetLng], 14);
              }
          }
      }

  }, [viewMode, driverLocation, activeTarget, branches]);


  const handleConfirm = () => {
      if (confirmAction) {
          if (confirmAction.type === 'PICKUP') {
              confirmPickup(confirmAction.taskId);
          } else {
              completeDelivery(confirmAction.taskId);
          }
          setConfirmAction(null);
      }
  };

  const renderTask = (task: typeof requests[0], type: 'PICKUP' | 'DELIVER') => {
      const fromBranch = branches.find(b => b.id === task.targetBranchId);
      const toBranch = branches.find(b => b.id === task.requesterBranchId);
      const product = products.find(p => p.code === task.productCode);

      // Calculate Estimate for Delivery Phase
      let distance = 0;
      let estTime = 0;
      if (type === 'DELIVER' && fromBranch && toBranch && fromBranch.location && toBranch.location) {
          distance = getDistanceKm(fromBranch.location, toBranch.location);
          // Scooter Speed: 40 km/h
          // Time = (Distance / Speed) * 60 minutes
          // Buffer: +5 minutes for parking/traffic
          estTime = Math.round((distance / 40) * 60 + 5);
      }

      return (
        <div key={task.id} className={`bg-white p-5 rounded-xl shadow-md border-r-4 ${type === 'PICKUP' ? 'border-orange-500' : 'border-blue-500'} mb-4 animate-fade-in`}>
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="font-bold text-lg text-black flex items-center gap-2">
                        {product?.name}
                        {product?.isFridge && <Snowflake size={20} className="text-blue-500" />}
                    </h3>
                    {product?.isFridge && (
                        <div className="bg-blue-100 text-blue-900 text-xs px-2 py-1 rounded mt-1 font-bold inline-flex items-center gap-1">
                            <Snowflake size={12}/> تنبيه: شحنة ثلاجة (حافظ على البرودة)
                        </div>
                    )}
                    <div className="flex flex-col mt-1">
                        <span className="text-sm text-gray-700">الكمية المصروفة: <span className="font-bold text-black">{task.issuedQuantity || task.quantity}</span></span>
                        <span className="text-xs text-gray-500">رقم الإذن: {task.issueNumber}</span>
                    </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded font-bold ${type === 'PICKUP' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                    {type === 'PICKUP' ? 'مطلوب الاستلام' : 'جاري التوصيل'}
                </span>
            </div>
            
            <div className="space-y-4 relative">
                {/* Visual Timeline */}
                <div className="absolute right-[11px] top-2 bottom-2 w-0.5 bg-gray-200"></div>

                {/* FROM NODE */}
                <div className={`flex items-start gap-3 relative z-10 ${type === 'DELIVER' ? 'opacity-50' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border-2 border-white shadow-sm ${type === 'PICKUP' ? 'bg-orange-100' : 'bg-gray-200'}`}>
                        <div className={`w-2 h-2 rounded-full ${type === 'PICKUP' ? 'bg-orange-600' : 'bg-gray-400'}`}></div>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 font-bold">استلام من (المصدر)</p>
                        <p className="font-bold text-black">{fromBranch?.name}</p>
                        <p className="text-xs text-gray-600">{fromBranch?.address}</p>
                    </div>
                </div>

                {/* TO NODE */}
                <div className={`flex items-start gap-3 relative z-10 ${type === 'PICKUP' ? 'opacity-50' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border-2 border-white shadow-sm ${type === 'DELIVER' ? 'bg-blue-100' : 'bg-gray-200'}`}>
                        <div className={`w-2 h-2 rounded-full ${type === 'DELIVER' ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 font-bold">تسليم إلى (الهدف)</p>
                        <p className="font-bold text-black">{toBranch?.name}</p>
                        <p className="text-xs text-gray-600">{toBranch?.address}</p>
                    </div>
                </div>
            </div>

            {/* Estimation Info Bar for Delivery Phase */}
            {type === 'DELIVER' && (
                <div className="mt-4 bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center justify-between text-blue-900">
                     <div className="flex flex-col items-center flex-1 border-l border-blue-200 pl-2">
                         <span className="text-[10px] text-blue-500 font-bold mb-1 flex items-center gap-1">
                             <Milestone size={10} /> المسافة
                         </span>
                         <span className="font-mono font-bold text-sm">{distance.toFixed(1)} km</span>
                     </div>
                     <div className="flex flex-col items-center flex-1 border-l border-blue-200 pl-2">
                         <span className="text-[10px] text-blue-500 font-bold mb-1 flex items-center gap-1">
                             <Clock size={10} /> الوقت المتوقع
                         </span>
                         <span className="font-mono font-bold text-sm">{estTime} دقيقة</span>
                     </div>
                     <div className="flex flex-col items-center flex-1">
                         <span className="text-[10px] text-blue-500 font-bold mb-1">وقت التحرك</span>
                         <span className="font-mono text-sm">
                             {task.pickedUpAt ? new Date(task.pickedUpAt).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'}) : '-'}
                         </span>
                     </div>
                </div>
            )}

            <div className="mt-6 pt-4 border-t">
                {type === 'PICKUP' ? (
                    <button 
                        onClick={() => setConfirmAction({ taskId: task.id, type: 'PICKUP' })}
                        className="w-full bg-orange-600 text-white py-3 rounded-lg font-bold hover:bg-orange-700 transition flex items-center justify-center gap-2 shadow-lg hover:shadow-orange-200"
                    >
                        <PlayCircle size={20} />
                        تأكيد استلام الشحنة وبدء التحرك
                    </button>
                ) : (
                    <button 
                        onClick={() => setConfirmAction({ taskId: task.id, type: 'DELIVER' })}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-lg hover:shadow-blue-200"
                    >
                        <CheckSquare size={20} />
                        تأكيد الوصول وتسليم الشحنة
                    </button>
                )}
            </div>
        </div>
      );
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-black flex items-center gap-2">
            <Package className="text-orange-600" />
            مهام التوصيل
        </h2>
        <div className="flex bg-white rounded-lg shadow p-1">
            <button 
                onClick={() => setViewMode('LIST')} 
                className={`p-2 rounded-md flex items-center gap-2 text-sm font-bold ${viewMode === 'LIST' ? 'bg-black text-white' : 'text-gray-600'}`}
            >
                <List size={16} /> قائمة
            </button>
            <button 
                onClick={() => setViewMode('MAP')} 
                className={`p-2 rounded-md flex items-center gap-2 text-sm font-bold ${viewMode === 'MAP' ? 'bg-orange-600 text-white' : 'text-gray-600'}`}
            >
                <MapIcon size={16} /> الخريطة
            </button>
        </div>
      </div>

      {/* MAP VIEW CONTAINER */}
      {viewMode === 'MAP' && (
          <div className="bg-white p-2 rounded-xl shadow-lg border-4 border-orange-500 h-[500px] relative animate-fade-in">
              {!driverLocation && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-lg">
                      <div className="bg-white p-4 rounded shadow text-center max-w-xs">
                          {locationError ? (
                              <>
                                <AlertTriangle className="text-red-500 mx-auto mb-2" size={32} />
                                <span className="text-sm font-bold text-red-600 block mb-2">{locationError}</span>
                                <p className="text-xs text-gray-500">يرجى تفعيل خدمة الموقع (GPS) في المتصفح وإعادة تحميل الصفحة.</p>
                              </>
                          ) : (
                              <>
                                <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                                <span className="text-sm font-bold text-gray-700">جاري تحديد موقعك بدقة...</span>
                              </>
                          )}
                      </div>
                  </div>
              )}
              <div id="map-container" className="w-full h-full rounded-lg overflow-hidden"></div>
              {activeTarget && (
                  <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur p-3 rounded-lg shadow-lg z-[400] border border-gray-200">
                      <p className="text-xs font-bold text-gray-500">الوجهة الحالية:</p>
                      <p className="font-bold text-black text-sm">
                          {activeTarget.status === RequestStatus.ASSIGNED ? 
                             `استلام من: ${branches.find(b => b.id === activeTarget.targetBranchId)?.name}` : 
                             `تسليم إلى: ${branches.find(b => b.id === activeTarget.requesterBranchId)?.name}`
                          }
                      </p>
                  </div>
              )}
          </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'LIST' && (
          <>
            {/* Section 1: To Pickup */}
            <div>
                <h3 className="font-bold text-lg text-gray-800 mb-3 flex items-center gap-2">
                    <Navigation size={20} className="text-orange-600" />
                    مهام الاستلام (توجه للفرع المورد)
                </h3>
                {pickupTasks.length === 0 ? (
                    <div className="bg-gray-50 border border-gray-200 rounded p-4 text-center text-gray-500 text-sm">لا توجد مهام استلام حالياً</div>
                ) : (
                    pickupTasks.map(t => renderTask(t, 'PICKUP'))
                )}
            </div>

            {/* Section 2: To Deliver */}
            <div>
                <h3 className="font-bold text-lg text-gray-800 mb-3 flex items-center gap-2">
                    <ArrowRight size={20} className="text-blue-600" />
                    جاري التوصيل (في الطريق للفرع الطالب)
                </h3>
                {deliveryTasks.length === 0 ? (
                    <div className="bg-gray-50 border border-gray-200 rounded p-4 text-center text-gray-500 text-sm">لا توجد شحنات في الطريق حالياً</div>
                ) : (
                    deliveryTasks.map(t => renderTask(t, 'DELIVER'))
                )}
            </div>
          </>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border-t-8 border-orange-500 transform transition-all scale-100">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 mb-4">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {confirmAction.type === 'PICKUP' ? 'تأكيد استلام الشحنة' : 'تأكيد تسليم الشحنة'}
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                        {confirmAction.type === 'PICKUP' ? (
                            "هل أنت متأكد من استلام البضاعة من الفرع المورد ومراجعة الإذن وصحة الكميات؟"
                        ) : (
                            "هل وصلت للفرع الطالب وقمت بتسليم الشحنة بالكامل لمسئول الفرع؟"
                        )}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleConfirm}
                        className="flex-1 bg-orange-600 text-white py-3 rounded-lg font-bold hover:bg-orange-700 transition shadow-lg"
                    >
                        نعم، تأكيد
                    </button>
                    <button 
                        onClick={() => setConfirmAction(null)}
                        className="flex-1 bg-gray-100 text-gray-800 py-3 rounded-lg font-bold hover:bg-gray-200 transition"
                    >
                        تراجع
                    </button>
                </div>
            </div>
          </div>
      )}
    </div>
  );
};

export default DeliveryView;
