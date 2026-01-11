'use client';

import { useEffect, useState } from 'react';
import { X, AlertTriangle, FileText, Bell } from 'lucide-react';
import { notificationsAPI, Alert } from '@/lib/api/notifications';
import { setupPushNotifications, isPushSupported, getNotificationPermission } from '@/lib/api/push';

interface AlertPopupProps {
  onClose?: () => void;
}

export default function AlertPopup({ onClose }: AlertPopupProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPushPrompt, setShowPushPrompt] = useState(false);

  useEffect(() => {
    const checkAlerts = async () => {
      try {
        const result = await notificationsAPI.checkAlerts();
        setAlerts(result.alerts);

        // 푸시 알림 권한 체크
        if (isPushSupported() && getNotificationPermission() === 'default') {
          setShowPushPrompt(true);
        }
      } catch (error) {
        console.error('Failed to check alerts:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAlerts();
  }, []);

  const handleEnablePush = async () => {
    const success = await setupPushNotifications();
    if (success) {
      setShowPushPrompt(false);
    }
  };

  const handleClose = () => {
    setAlerts([]);
    setShowPushPrompt(false);
    onClose?.();
  };

  // 아무것도 표시할 것이 없으면 렌더링 안함
  if (loading || (alerts.length === 0 && !showPushPrompt)) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="text-white" size={24} />
            <h2 className="text-xl font-bold text-white">알림</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-white/80 hover:text-white transition p-1"
          >
            <X size={24} />
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* 알림 목록 */}
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`rounded-xl p-4 ${
                alert.severity === 'warning'
                  ? 'bg-amber-50 border border-amber-200'
                  : 'bg-blue-50 border border-blue-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    alert.severity === 'warning' ? 'bg-amber-100' : 'bg-blue-100'
                  }`}
                >
                  {alert.type === 'record_missing' ? (
                    <AlertTriangle
                      className={alert.severity === 'warning' ? 'text-amber-600' : 'text-blue-600'}
                      size={20}
                    />
                  ) : (
                    <FileText
                      className={alert.severity === 'warning' ? 'text-amber-600' : 'text-blue-600'}
                      size={20}
                    />
                  )}
                </div>
                <div className="flex-1">
                  <h3
                    className={`font-semibold ${
                      alert.severity === 'warning' ? 'text-amber-800' : 'text-blue-800'
                    }`}
                  >
                    {alert.title}
                  </h3>
                  <p
                    className={`text-sm mt-1 ${
                      alert.severity === 'warning' ? 'text-amber-700' : 'text-blue-700'
                    }`}
                  >
                    {alert.message}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* 푸시 알림 권한 요청 */}
          {showPushPrompt && (
            <div className="rounded-xl p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900">
                  <Bell className="text-slate-600 dark:text-slate-400" size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">푸시 알림 설정</h3>
                  <p className="text-sm mt-1 text-slate-600 dark:text-slate-300">
                    중요한 알림을 놓치지 않도록 푸시 알림을 허용해주세요.
                  </p>
                  <button
                    onClick={handleEnablePush}
                    className="mt-3 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition"
                  >
                    알림 허용하기
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={handleClose}
            className="w-full py-3 bg-slate-800 dark:bg-slate-700 text-white font-medium rounded-xl hover:bg-slate-900 dark:hover:bg-slate-600 transition"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
