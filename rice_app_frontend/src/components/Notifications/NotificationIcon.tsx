import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import NotificationDropdown from './NotificationDropdown';

const NotificationIcon: React.FC = () => {
  const { unreadCount } = useNotifications();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);


  return (
    <div ref={wrapperRef} style={{ position: 'relative', marginRight: '20px' }}>
      <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} style={{background: 'none', border: 'none', cursor: 'pointer', position: 'relative'}}>
        BellIcon {/* Placeholder for an actual Bell icon SVG or FontAwesome */}
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            background: 'red',
            color: 'white',
            borderRadius: '50%',
            padding: '2px 5px',
            fontSize: '0.7em'
          }}>
            {unreadCount}
          </span>
        )}
      </button>
      <NotificationDropdown isOpen={isDropdownOpen} onClose={() => setIsDropdownOpen(false)} />
    </div>
  );
};

export default NotificationIcon;
