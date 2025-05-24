import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Entry from './pages/Entry';
import Room from './pages/Room';
import AudioTest from './pages/AudioTest';
import { useUserStore } from './store/userStore';

function App() {
  const { username } = useUserStore();
  
  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-white">
        <Routes>
          <Route path="/" element={<Entry />} />
          <Route 
            path="/room/:roomId" 
            element={username ? <Room /> : <Navigate to="/" replace />} 
          />
          <Route path="/audio-test" element={<AudioTest />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;