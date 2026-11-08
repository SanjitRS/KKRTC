import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, Info, Calendar, X } from 'lucide-react';

export default function NoticeBanner({ announcements = [], onDismiss = null }) {
  const [dismissedIds, setDismissedIds] = useState(new Set());

  const activeNotices = announcements.filter(a => !dismissedIds.has(a.id));

  if (activeNotices.length === 0) return null;

  const handleDismiss = (id) => {
    setDismissedIds(prev => new Set(prev).add(id));
    if (onDismiss) onDismiss(id);
  };

  return (
    <div className="space-y-2 mb-3">
      {activeNotices.map((notice) => {
        const isUrgent = notice.priority === 'urgent' || notice.category === 'breakdown';
        const isDelay = notice.category === 'delay' || notice.category === 'route_change';

        let borderColor = 'border-blue-500/30';
        let bgColor = 'bg-blue-950/60';
        let textColor = 'text-blue-300';
        let Icon = Info;

        if (isUrgent) {
          borderColor = 'border-rose-500/40';
          bgColor = 'bg-rose-950/70';
          textColor = 'text-rose-300';
          Icon = AlertCircle;
        } else if (isDelay) {
          borderColor = 'border-amber-500/40';
          bgColor = 'bg-amber-950/70';
          textColor = 'text-amber-300';
          Icon = AlertTriangle;
        } else if (notice.category === 'holiday') {
          borderColor = 'border-purple-500/40';
          bgColor = 'bg-purple-950/70';
          textColor = 'text-purple-300';
          Icon = Calendar;
        }

        return (
          <div
            key={notice.id}
            className={`border ${borderColor} ${bgColor} rounded-xl p-3 shadow-lg relative flex items-start space-x-2.5 transition-all animate-fadeIn`}
          >
            <div className={`p-1.5 rounded-lg bg-black/20 flex-shrink-0 ${textColor}`}>
              <Icon className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center space-x-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${textColor}`}>
                  {notice.title}
                </span>
                {notice.route_name && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/30 text-slate-300 border border-white/10">
                    {notice.route_code || notice.route_name}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">
                {notice.message}
              </p>
            </div>

            <button
              onClick={() => handleDismiss(notice.id)}
              className="absolute top-2.5 right-2.5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              title="Dismiss announcement"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
