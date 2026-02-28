import React, { useState, useEffect } from 'react';
import { Plus, Users, MessageCircle, Upload, Download, Trash2, LogOut, Search, FileText, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import * as db from '../lib/db';

interface StudyGroup {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
}

interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

interface GroupMessage {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: { full_name: string; email: string };
}

interface GroupFile {
  id: string;
  group_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  created_at: string;
  user?: { full_name: string };
}

interface UploadingFile {
  id: string;
  name: string;
  progress: number;
}

export default function StudyGroupsPage({ userId }: { userId: string }) {
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [files, setFiles] = useState<GroupFile[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'files'>('chat');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      fetchGroupMembers();
      fetchGroupMessages();
      fetchGroupFiles();
    }
  }, [selectedGroup]);

  const fetchGroups = async () => {
    try {
      const allGroups = await db.fetchStudyGroups();
      setGroups(allGroups as StudyGroup[]);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  const fetchGroupMembers = async () => {
    if (!selectedGroup) return;
    try {
      const { data } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', selectedGroup.id);
      setGroupMembers(data || []);
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  };

  const fetchGroupMessages = async () => {
    if (!selectedGroup) return;
    try {
      const { data } = await supabase
        .from('group_messages')
        .select('*, users(full_name, email)')
        .eq('group_id', selectedGroup.id)
        .order('created_at', { ascending: true });
      setMessages(data || []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const fetchGroupFiles = async () => {
    if (!selectedGroup) return;
    try {
      const { data } = await supabase
        .from('group_files')
        .select('*, users(full_name)')
        .eq('group_id', selectedGroup.id)
        .order('created_at', { ascending: false });
      setFiles(data || []);
    } catch (error) {
      console.error('Failed to fetch files:', error);
    }
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      setIsLoading(true);
      const groupId = await db.createStudyGroup(userId, newGroupName, newGroupDesc);

      await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: userId,
          role: 'owner'
        });

      setNewGroupName('');
      setNewGroupDesc('');
      setShowCreateModal(false);
      await fetchGroups();
    } catch (error) {
      console.error('Failed to create group:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedGroup) return;
    try {
      const { error } = await supabase
        .from('group_messages')
        .insert({
          group_id: selectedGroup.id,
          user_id: userId,
          content: newMessage
        });

      if (!error) {
        setNewMessage('');
        await fetchGroupMessages();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedGroup || !e.target.files?.length) return;
    const uploadedFiles = Array.from(e.target.files);

    try {
      setIsLoading(true);
      setError(null);

      for (const file of uploadedFiles) {
        const fileId = `${Date.now()}_${Math.random()}`;
        const fileName = `${fileId}_${file.name}`;
        
        // Add to uploading list
        setUploadingFiles(prev => [...prev, { id: fileId, name: file.name, progress: 0 }]);

        try {
          // Simulate progress (real progress would come from supabase listener)
          const progressInterval = setInterval(() => {
            setUploadingFiles(prev => prev.map(f => 
              f.id === fileId ? { ...f, progress: Math.min(f.progress + Math.random() * 30, 90) } : f
            ));
          }, 200);

          const { error: uploadError } = await supabase.storage
            .from('group-files')
            .upload(`${selectedGroup.id}/${fileName}`, file);

          clearInterval(progressInterval);

          if (uploadError) {
            throw new Error(uploadError.message);
          }

          // Set to 100% after successful upload
          setUploadingFiles(prev => prev.map(f => 
            f.id === fileId ? { ...f, progress: 100 } : f
          ));

          // Wait a moment to show 100% progress
          await new Promise(resolve => setTimeout(resolve, 300));

          const { data: { publicUrl } } = supabase.storage
            .from('group-files')
            .getPublicUrl(`${selectedGroup.id}/${fileName}`);

          await supabase
            .from('group_files')
            .insert({
              group_id: selectedGroup.id,
              user_id: userId,
              file_name: file.name,
              file_url: publicUrl
            });

          // Remove from uploading list
          setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
        } catch (err) {
          // Clear uploading status with delay before showing error
          await new Promise(resolve => setTimeout(resolve, 2000));
          setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
          const errorMsg = err instanceof Error ? err.message : 'Upload failed';
          setError(`Failed to upload ${file.name}: ${errorMsg}`);
          console.error(`Failed to upload ${file.name}:`, err);
        }
      }

      await fetchGroupFiles();
    } catch (error) {
      console.error('Failed to upload files:', error);
      setError('Failed to process upload');
    } finally {
      setIsLoading(false);
    }

    // Clear error after 5 seconds
    if (error) {
      setTimeout(() => setError(null), 5000);
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group? This action cannot be undone.')) return;
    try {
      await db.deleteStudyGroup(userId, groupId);
      await fetchGroups();
      setSelectedGroup(null);
    } catch (error) {
      console.error('Failed to delete group:', error);
      setError('Failed to delete group');
    }
  };

  const deleteFile = async (fileId: string) => {
    if (!selectedGroup) return;
    try {
      const { error } = await supabase
        .from('group_files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;

      await fetchGroupFiles();
      setError(null);
    } catch (err) {
      console.error('Failed to delete file:', err);
      setError('Failed to delete file');
      setTimeout(() => setError(null), 4000);
    }
  };

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="w-full h-full bg-slate-50 flex flex-col overflow-hidden"
    >
      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-red-50 border-b border-red-200 px-6 py-3 text-red-700 text-sm font-medium"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-sm">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 flex-shrink-0">
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition-all shadow-md"
            >
              <Plus size={18} />
              Create Group
            </button>
          </div>

          {/* Search */}
          <div className="p-3.5 border-b border-slate-200 flex-shrink-0">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Groups List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {filteredGroups.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm flex items-center justify-center h-full">
                No groups yet. Create one to get started.
              </div>
            ) : (
              <nav className="divide-y divide-slate-100">
                {filteredGroups.map(group => (
                  <motion.button
                    key={group.id}
                    onClick={() => setSelectedGroup(group)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      selectedGroup?.id === group.id
                        ? 'bg-indigo-50 border-l-4 border-l-indigo-500'
                        : 'hover:bg-slate-50'
                    }`}
                    whileHover={{ backgroundColor: selectedGroup?.id !== group.id ? 'rgb(248 250 252)' : undefined }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="font-semibold text-sm text-slate-900 truncate">{group.name}</div>
                    <div className="text-xs text-slate-500 truncate mt-1">{group.description || 'No description'}</div>
                  </motion.button>
                ))}
              </nav>
            )}
          </div>
        </div>

        {/* Main Content */}
        {selectedGroup ? (
          <div className="flex-1 flex flex-col bg-white">
            {/* Header */}
            <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0 shadow-sm">
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-slate-900 truncate">{selectedGroup.name}</h1>
                <p className="text-xs text-slate-500 truncate mt-0.5">{selectedGroup.description || 'No description'}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                <button
                  onClick={() => setSelectedGroup(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Close group"
                >
                  <LogOut size={18} className="text-slate-600" />
                </button>
                {selectedGroup.created_by === userId && (
                  <button
                    onClick={() => deleteGroup(selectedGroup.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete group"
                  >
                    <Trash2 size={18} className="text-red-500" />
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="h-12 bg-white border-b border-slate-200 px-6 flex items-end gap-8 flex-shrink-0">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-2 py-3 border-b-2 transition-colors text-sm font-semibold whitespace-nowrap ${
                  activeTab === 'chat'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <MessageCircle size={16} />
                Chat
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={`flex items-center gap-2 py-3 border-b-2 transition-colors text-sm font-semibold whitespace-nowrap ${
                  activeTab === 'files'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <FileText size={16} />
                Files ({files.length})
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col bg-slate-50">
              {/* Chat Tab */}
              {activeTab === 'chat' && (
                <>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-slate-400 text-sm">
                          <MessageCircle size={32} className="mx-auto mb-3 opacity-50" />
                          No messages yet. Start the conversation!
                        </div>
                      </div>
                    ) : (
                      messages.map(msg => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold text-sm text-slate-900">{msg.user?.full_name || 'User'}</span>
                              <span className="text-xs text-slate-400">
                                {new Date(msg.created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed">{msg.content}</p>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>

                  <div className="bg-white border-t border-slate-200 px-6 py-4 flex-shrink-0 shadow-lg">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                      <button
                        onClick={sendMessage}
                        className="px-6 py-2.5 text-sm bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition-all shadow-md"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Files Tab */}
              {activeTab === 'files' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-6 border-b border-slate-200 flex-shrink-0 bg-white">
                    <label className={`flex items-center justify-center gap-3 p-6 bg-gradient-to-b from-indigo-50 to-indigo-50 border-2 border-dashed border-indigo-300 rounded-xl cursor-pointer hover:from-indigo-100 hover:to-indigo-50 transition-all ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}>
                      {isLoading ? (
                        <Loader2 size={20} className="text-indigo-600 flex-shrink-0 animate-spin" />
                      ) : (
                        <Upload size={20} className="text-indigo-600 flex-shrink-0" />
                      )}
                      <div>
                        <div className="font-semibold text-indigo-600 text-sm">{isLoading ? 'Uploading...' : 'Upload Files'}</div>
                        <div className="text-xs text-indigo-500">Drag and drop or click to select</div>
                      </div>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={isLoading}
                      />
                    </label>
                  </div>

                  {/* Uploading Files Progress */}
                  {uploadingFiles.length > 0 && (
                    <div className="px-6 py-4 border-b border-slate-200 bg-white flex-shrink-0 space-y-3">
                      {uploadingFiles.map(uploadFile => (
                        <motion.div
                          key={uploadFile.id}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Loader2 size={14} className="text-indigo-500 flex-shrink-0 animate-spin" />
                                <span className="text-xs font-medium text-slate-700 truncate">{uploadFile.name}</span>
                              </div>
                              <span className="text-xs text-slate-500 flex-shrink-0 ml-2">{Math.round(uploadFile.progress)}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-600"
                                initial={{ width: 0 }}
                                animate={{ width: `${uploadFile.progress}%` }}
                                transition={{ duration: 0.3 }}
                              />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    {files.length === 0 && uploadingFiles.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-slate-400 text-sm">
                          <FileText size={32} className="mx-auto mb-3 opacity-50" />
                          No files yet. Upload some to share with the group.
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {files.map(file => (
                          <motion.div
                            key={file.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center justify-between p-3.5 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all group"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <FileText size={18} className="text-indigo-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm text-slate-900 truncate">{file.file_name}</div>
                                <div className="text-xs text-slate-500">{file.user?.full_name}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                              <a
                                href={file.file_url}
                                download
                                className="p-2 hover:bg-indigo-100 rounded-lg transition-colors text-indigo-600"
                                title="Download"
                              >
                                <Download size={16} />
                              </a>
                              {selectedGroup.created_by === userId && (
                                <button
                                  onClick={() => deleteFile(file.id)}
                                  className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600 opacity-0 group-hover:opacity-100"
                                  title="Delete file"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <Users size={64} className="mx-auto text-slate-300 mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Select a Group</h2>
              <p className="text-slate-500 text-sm">Choose a group from the sidebar to get started</p>
            </motion.div>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Create Study Group</h2>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Group Name</label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g., Physics Study Group"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                  <textarea
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    placeholder="What's this group about?"
                    rows={3}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 active:scale-95 transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={createGroup}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </motion.div>
          </motion.div>
          )}
          </AnimatePresence>
          </motion.div>
          );
          }
