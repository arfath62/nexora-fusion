import { useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Download, Lock, Server, Shield, Trash2 } from 'lucide-react';
import databaseService from '../../services/DatabaseService';

export default function ChatSecurity() {
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      // Get all data from database
      const chats = await databaseService.getAllChats();
      
      // Create a JSON blob
      const exportData = {
        chats,
        exportDate: new Date().toISOString(),
        version: '1.0.0'
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create a download link and trigger it
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexora-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting data:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearAllData = async () => {
    if (window.confirm('Are you sure you want to clear all your data? This cannot be undone.')) {
      try {
        setIsClearing(true);
        await databaseService.clearAll();
        alert('All data has been cleared successfully.');
        window.location.reload();
      } catch (error) {
        console.error('Error clearing data:', error);
        alert('Failed to clear data. Please try again.');
      } finally {
        setIsClearing(false);
      }
    }
  };

  return (
    <motion.div
      className="p-6 max-w-4xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-400 to-purple-600 text-transparent bg-clip-text">
        Data Security & Privacy
      </h2>
      
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gradient-to-br from-indigo-950/40 to-indigo-900/20 p-5 rounded-xl border border-indigo-800/30 backdrop-blur-sm">
          <div className="flex items-center mb-3">
            <Shield className="text-indigo-400 mr-3" size={24} />
            <h3 className="text-lg font-medium text-indigo-300">Local Storage Security</h3>
          </div>
          <p className="text-gray-300 text-sm">
            Your data is stored locally in your browser using IndexedDB with AES-256 encryption. 
            No data is sent to external servers without your explicit permission.
          </p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-950/40 to-purple-900/20 p-5 rounded-xl border border-purple-800/30 backdrop-blur-sm">
          <div className="flex items-center mb-3">
            <Lock className="text-purple-400 mr-3" size={24} />
            <h3 className="text-lg font-medium text-purple-300">Data Encryption</h3>
          </div>
          <p className="text-gray-300 text-sm">
            All sensitive data is encrypted using AES-256 before being stored. 
            Encryption keys are securely managed within your browser's protected storage.
          </p>
        </div>
        
        <div className="bg-gradient-to-br from-blue-950/40 to-blue-900/20 p-5 rounded-xl border border-blue-800/30 backdrop-blur-sm">
          <div className="flex items-center mb-3">
            <Server className="text-blue-400 mr-3" size={24} />
            <h3 className="text-lg font-medium text-blue-300">Crash Protection</h3>
          </div>
          <p className="text-gray-300 text-sm">
            Nexora features an automatic backup and recovery system that protects your data 
            from browser crashes or corruption, ensuring no work is ever lost.
          </p>
        </div>
        
        <div className="bg-gradient-to-br from-cyan-950/40 to-cyan-900/20 p-5 rounded-xl border border-cyan-800/30 backdrop-blur-sm">
          <div className="flex items-center mb-3">
            <Database className="text-cyan-400 mr-3" size={24} />
            <h3 className="text-lg font-medium text-cyan-300">Data Integrity</h3>
          </div>
          <p className="text-gray-300 text-sm">
            Every piece of data includes version control and checksums to ensure integrity.
            The system can detect and repair corrupted data automatically.
          </p>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4 mt-8">
        <button 
          className="flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors"
          onClick={handleExportData}
          disabled={isExporting}
        >
          <Download size={18} className="mr-2" />
          {isExporting ? 'Exporting...' : 'Export Your Data'}
        </button>
        
        <button 
          className="flex items-center justify-center px-4 py-2 bg-red-600/30 hover:bg-red-500/50 rounded-lg text-white transition-colors border border-red-500/30"
          onClick={handleClearAllData}
          disabled={isClearing}
        >
          <Trash2 size={18} className="mr-2" />
          {isClearing ? 'Clearing...' : 'Clear All Data'}
        </button>
      </div>
      
      <div className="mt-8 text-sm text-gray-400 bg-black/30 p-4 rounded-lg border border-gray-800/50">
        <p className="mb-2"><strong>About Enterprise Deployment:</strong></p>
        <p>
          For enterprise deployments, Nexora can be configured to use secure cloud databases 
          like Firebase Firestore, AWS DynamoDB, or Microsoft Azure Cosmos DB with proper 
          authentication, role-based access control, and end-to-end encryption.
        </p>
      </div>
    </motion.div>
  );
}
