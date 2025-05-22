import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Monitor, Users, Play } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { useRoomStore } from '../store/roomStore';

const Entry: React.FC = () => {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [nameError, setNameError] = useState('');
  const { setUsername } = useUserStore();
  const { setRoomId: storeSetRoomId } = useRoomStore();
  const navigate = useNavigate();
  
  // Generate a room ID if creating a new room
  useEffect(() => {
    if (isCreating && !roomId) {
      setRoomId(uuidv4().substring(0, 8));
    }
  }, [isCreating, roomId]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setNameError('Please enter your name');
      return;
    }
    
    setUsername(name);
    
    const finalRoomId = isCreating 
      ? roomId 
      : roomId.trim() || uuidv4().substring(0, 8);
      
    storeSetRoomId(finalRoomId);
    navigate(`/room/${finalRoomId}`);
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="card max-w-md w-full slide-up">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Monitor className="w-16 h-16 text-blue-500" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">ScreenShare</h1>
          <p className="text-gray-400">Watch together in real-time with audio</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
              Your Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError('');
              }}
              className="input w-full"
              placeholder="Enter your display name"
              maxLength={20}
            />
            {nameError && <p className="mt-1 text-sm text-red-500">{nameError}</p>}
          </div>
          
          <div className="flex space-x-4">
            <button
              type="button"
			  style={{
				justifyContent: "center",
				alignItems: "center",
				display: "flex"
			  }}
              className={`flex-1 btn ${isCreating ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setIsCreating(true)}
            >
              <Play size={18} className="mr-2" />
              Create Room
            </button>
            <button
              type="button"
			  style={{
				justifyContent: "center",
				alignItems: "center",
				display: "flex"
			  }}
              className={`flex-1 btn ${!isCreating ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setIsCreating(false)}
            >
              <Users size={18} className="mr-2" />
              Join Room
            </button>
          </div>
          
          {isCreating ? (
            <div>
              <label htmlFor="create-room" className="block text-sm font-medium text-gray-300 mb-1">
                Room Code (Auto-generated)
              </label>
              <input
                id="create-room"
                type="text"
                value={roomId}
                readOnly
                className="input w-full bg-gray-700 cursor-not-allowed"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="join-room" className="block text-sm font-medium text-gray-300 mb-1">
                Room Code
              </label>
              <input
                id="join-room"
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="input w-full"
                placeholder="Enter room code"
              />
            </div>
          )}
          
          <button type="submit" className="btn-primary w-full">
            {isCreating ? 'Create & Join' : 'Join Room'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Entry;