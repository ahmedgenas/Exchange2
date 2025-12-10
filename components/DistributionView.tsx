
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { RequestStatus, UserRole } from '../types';
import { Truck, UserCheck, Snowflake, Map as MapIcon, List, Navigation, Bike, Store, Flag } from 'lucide-react';
import * as L from 'leaflet';

const DistributionView: React.FC = () => {
  const { requests, users, branches, products, assignDriver } = useStore();
  const [viewMode, setViewMode] = useState<'LIST' | 'MAP'>('LIST');

  // Requests ready for distribution (Accepted by branch, waiting for driver)
  const readyRequests = requests.filter(r => r.status === RequestStatus.DISTRIBUTION);
  
  // Active Deliveries (For Map Monitoring)
  const activeDeliveries = requests.filter(r => r.status === RequestStatus.ASSIGNED || r.status === RequestStatus.PICKED_UP);

  const drivers = users.filter(u => u.role === UserRole.DELIVERY);

  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Layer[]>([]);

  // --- Map Effect ---
  useEffect(() => {
    if (viewMode === 'MAP') {
        // Delay init to ensure DOM is ready
        setTimeout(() => {
            if (!document.getElementById('dist-map')) return;
            if (mapRef.current) return;

            // Default View (Cairo)
            const map = L.map('dist-map').setView([30.0444, 31.2357], 11);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            mapRef.current = map;
        }, 100);
    } else {
        // Cleanup
        if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
            markersRef.current = [];
        }
    }
  }, [viewMode]);

  // --- Update Map Markers ---
  useEffect(() => {
    if (viewMode !== 'MAP' || !mapRef.current) return;
    const map = mapRef.current;

    // Clear old layers
    markersRef.current.forEach(l => l.remove());
    markersRef.current = [];

    if (activeDeliveries.length === 0) return;

    const bounds = L.latLngBounds([]);

    activeDeliveries.forEach(req => {
        const sourceBranch = branches.find(b => b.id === req.targetBranchId); // From
        const destBranch = branches.find(b => b.id === req.requesterBranchId); // To
        const driver = users.find(u => u.id === req.driverId);
        const prod = products.find(p => p.code === req.productCode);

        // SAFEGUARD: Ensure locations exist
        if (sourceBranch && destBranch && sourceBranch.location && destBranch.location) {
            // 1. Source Marker (Store)
            const sourceIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color:#ea580c; width:28px; height:28px; border-radius:50%; border:2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:white;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>
                       </div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 28],
                popupAnchor: [0, -28]
            });
            const sm = L.marker([sourceBranch.location.lat, sourceBranch.location.lng], { icon: sourceIcon })
                .bindPopup(`
                    <div class="text-right">
                        <strong class="text-orange-600 block mb-1">استلام من: ${sourceBranch.name}</strong>
                        <span class="text-xs text-gray-600">${prod?.name} (${req.issuedQuantity || req.quantity})</span>
                    </div>
                `)
                .addTo(map);
            markersRef.current.push(sm);
            bounds.extend([sourceBranch.location.lat, sourceBranch.location.lng]);

            // 2. Dest Marker (Flag)
            const destIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color:#2563eb; width:28px; height:28px; border-radius:50%; border:2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:white;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>
                       </div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 28],
                popupAnchor: [0, -28]
            });
            const dm = L.marker([destBranch.location.lat, destBranch.location.lng], { icon: destIcon })
                .bindPopup(`
                    <div class="text-right">
                        <strong class="text-blue-600 block mb-1">تسليم إلى: ${destBranch.name}</strong>
                        <span class="text-xs text-gray-500">${destBranch.address}</span>
                    </div>
                `)
                .addTo(map);
            markersRef.current.push(dm);
            bounds.extend([destBranch.location.lat, destBranch.location.lng]);

            // 3. Driver Marker (Real Position if available)
            // Default position (simulated near source) if no GPS yet
            let driverLat = sourceBranch.location.lat + 0.002;
            let driverLng = sourceBranch.location.lng + 0.002;
            let isRealTime = false;
            let lastUpdateText = "";

            if (driver && driver.lastLocation && driver.lastLocation.lat) {
                driverLat = driver.lastLocation.lat;
                driverLng = driver.lastLocation.lng;
                isRealTime = true;
                
                const secondsAgo = Math.floor((Date.now() - driver.lastLocation.timestamp) / 1000);
                if (secondsAgo < 60) lastUpdateText = `منذ ${secondsAgo} ثانية`;
                else lastUpdateText = `منذ ${Math.floor(secondsAgo/60)} دقيقة`;
            }

            const driverIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `
                    <div style="position:relative; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">
                        ${isRealTime ? '<div style="position:absolute; width:100%; height:100%; border-radius:50%; background-color:rgba(0,0,0,0.3); animation:ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>' : ''}
                        <div style="position:relative; background-color:#1f2937; width:32px; height:32px; border-radius:50%; border:2px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; color:white; z-index:10;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
                        </div>
                    </div>
                `,
                iconSize: [40, 40],
                iconAnchor: [20, 20],
                popupAnchor: [0, -20]
            });

            const drm = L.marker([driverLat, driverLng], { icon: driverIcon, zIndexOffset: 1000 })
                .bindPopup(`
                    <div class="text-right min-w-[150px]">
                        <strong class="text-gray-900 block mb-1">${driver?.name || 'مجهول'}</strong>
                        <div class="text-xs mb-1">
                            <span class="font-bold">الحالة:</span> 
                            ${req.status === RequestStatus.PICKED_UP ? '<span class="text-blue-600">في الطريق للتسليم</span>' : '<span class="text-orange-600">في الطريق للاستلام</span>'}
                        </div>
                        ${isRealTime ? 
                            `<div class="text-[10px] text-green-600 font-bold flex items-center gap-1">
                                ● GPS متصل (${lastUpdateText})
                             </div>` : 
                            `<div class="text-[10px] text-red-500 font-bold">● GPS غير متصل (موقع تقديري)</div>`
                        }
                    </div>
                `)
                .addTo(map);
            markersRef.current.push(drm);

            // 4. Line Connection
            // Connect Driver to their Current Target
            const targetLat = req.status === RequestStatus.PICKED_UP ? destBranch.location.lat : sourceBranch.location.lat;
            const targetLng = req.status === RequestStatus.PICKED_UP ? destBranch.location.lng : sourceBranch.location.lng;
            
            const line = L.polyline([
                [driverLat, driverLng],
                [targetLat, targetLng]
            ], { 
                color: req.status === RequestStatus.PICKED_UP ? '#2563eb' : '#ea580c', 
                weight: 3, 
                dashArray: '5, 10',
                opacity: 0.6
            }).addTo(map);
            markersRef.current.push(line);
        }
    });

    if (activeDeliveries.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
    }

  }, [viewMode, activeDeliveries, branches, products, users]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-black flex items-center gap-2">
            <Truck className="text-orange-600" />
            إدارة التوزيع
        </h2>
        <div className="flex bg-white rounded-lg shadow p-1 border border-gray-200">
            <button 
                onClick={() => setViewMode('LIST')} 
                className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-bold transition ${viewMode === 'LIST' ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
                <List size={16} /> المهام
            </button>
            <button 
                onClick={() => setViewMode('MAP')} 
                className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-bold transition ${viewMode === 'MAP' ? 'bg-orange-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
                <MapIcon size={16} /> تتبع حي (Live Map)
            </button>
        </div>
      </div>

      {viewMode === 'LIST' && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden border-t-4 border-orange-500 animate-fade-in">
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-800">طلبات جاهزة للتوزيع ({readyRequests.length})</h3>
            </div>
            <table className="w-full text-right">
            <thead className="bg-gray-100 text-black font-bold">
                <tr>
                <th className="p-4">الصنف</th>
                <th className="p-4">الكمية المصروفة</th>
                <th className="p-4">من فرع</th>
                <th className="p-4">إلى فرع</th>
                <th className="p-4">رقم الإذن</th>
                <th className="p-4">تعيين مندوب</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {readyRequests.length === 0 ? (
                <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">لا يوجد طلبات جاهزة للتوزيع</td>
                </tr>
                ) : (
                readyRequests.map(req => {
                    const prod = products.find(p => p.code === req.productCode);
                    return (
                    <tr key={req.id} className="hover:bg-gray-50 transition animate-fade-in">
                    <td className="p-4 font-bold text-black flex items-center gap-2">
                        {prod?.name}
                        {prod?.isFridge && (
                        <span title="صنف ثلاجة">
                            <Snowflake size={16} className="text-blue-500" />
                        </span>
                        )}
                    </td>
                    <td className="p-4 font-bold text-green-700">
                        {req.issuedQuantity || req.quantity}
                    </td>
                    <td className="p-4 text-sm text-gray-900 font-medium">
                        {branches.find(b => b.id === req.targetBranchId)?.name}
                    </td>
                    <td className="p-4 text-sm text-gray-900 font-medium">
                        {branches.find(b => b.id === req.requesterBranchId)?.name}
                    </td>
                    <td className="p-4 text-sm font-mono">
                        {req.issueNumber || '-'}
                    </td>
                    <td className="p-4">
                        <div className="flex gap-2">
                        <select 
                            className="border p-2 rounded text-sm bg-white text-black focus:ring-2 focus:ring-orange-500 outline-none"
                            onChange={(e) => {
                            if(e.target.value) assignDriver(req.id, e.target.value);
                            }}
                            defaultValue=""
                        >
                            <option value="" disabled>اختر مندوب</option>
                            {drivers.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                        </div>
                    </td>
                    </tr>
                    );
                })
                )}
            </tbody>
            </table>
        </div>
      )}

      {viewMode === 'MAP' && (
          <div className="bg-white p-2 rounded-xl shadow-lg border-4 border-orange-500 h-[600px] relative animate-fade-in">
              <div id="dist-map" className="w-full h-full rounded-lg overflow-hidden z-0 bg-gray-100"></div>
              
              <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur p-4 rounded-lg shadow-xl z-[400] border border-gray-200">
                  <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <Navigation size={16} className="text-orange-600"/>
                      تتبع الأسطول
                  </h4>
                  <div className="flex flex-wrap gap-4 text-xs font-bold text-gray-600">
                      <div className="flex items-center gap-1.5">
                          <Store size={14} className="text-orange-600"/>
                          <span>نقطة الاستلام (Store)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                          <Flag size={14} className="text-blue-600"/>
                          <span>نقطة التسليم (Dest)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                          <Bike size={14} className="text-gray-800"/>
                          <span>موقع المندوب</span>
                      </div>
                  </div>
              </div>
          </div>
      )}
      <style>{`
        @keyframes ping {
            75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default DistributionView;
