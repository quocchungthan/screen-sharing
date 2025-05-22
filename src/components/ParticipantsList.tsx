import React from 'react';
import { Mic, MicOff, Share2, X, UserCircle } from 'lucide-react';
import { useRoomStore, Participant } from '../store/roomStore';
import { useUserStore } from '../store/userStore';

interface ParticipantsListProps {
  onClose: () => void;
}

const ParticipantsList: React.FC<ParticipantsListProps> = ({ onClose }) => {
  const { participants } = useRoomStore();
  const { username } = useUserStore();
  
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h2 className="text-lg font-medium">Participants ({participants.length})</h2>
        <button 
          className="p-1 rounded-full hover:bg-gray-700 transition-colors"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {participants.map((participant) => (
          <ParticipantItem 
            key={participant.id} 
            participant={participant}
            isCurrentUser={participant.username === username}
          />
        ))}
      </div>
    </div>
  );
};

interface ParticipantItemProps {
  participant: Participant;
  isCurrentUser: boolean;
}

const ParticipantItem: React.FC<ParticipantItemProps> = ({ participant, isCurrentUser }) => {
  const { username, isMuted, isSharing } = participant;
  
  return (
    <div className="participant border-b border-gray-700 last:border-b-0">
      <div className="flex-shrink-0 mr-3">
        <UserCircle size={32} className="text-gray-400" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <p className="text-sm font-medium truncate">
            {username} {isCurrentUser && <span className="text-xs text-gray-500">(you)</span>}
          </p>
          
          <div className="flex items-center space-x-2">
            {isSharing && (
              <Share2 size={16} className="text-blue-500" />
            )}
            
            {isMuted ? (
              <MicOff size={16} className="text-red-500" />
            ) : (
              <Mic size={16} className="text-green-500" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParticipantsList;