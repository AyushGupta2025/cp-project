import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Car, ArrowLeft, Lock, User } from 'lucide-react';

type Role = 'admin' | 'driver';

interface LoginPageProps {
  onLogin: (role: Role) => void;
}

const roles = [
  {
    id: 'admin' as Role,
    label: 'Admin',
    subtitle: 'System Administrator',
    icon: ShieldCheck,
    description: 'Full access to the parking management system, telemetry, fault injection, and audit ledger.',
    accent: 'border-indigo-500/50 hover:border-indigo-400',
    iconColor: 'text-indigo-400',
    iconBg: 'bg-indigo-500/10',
    btnClass: 'bg-indigo-500 hover:bg-indigo-400 text-white',
  },
  {
    id: 'driver' as Role,
    label: 'Driver',
    subtitle: 'Vehicle Operator',
    icon: Car,
    description: 'Access the driver portal to register vehicle entry and exit from the parking facility.',
    accent: 'border-emerald-500/50 hover:border-emerald-400',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    btnClass: 'bg-emerald-500 hover:bg-emerald-400 text-black font-bold',
  },
];

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleRoleSelection = (role: Role) => {
    if (role === 'admin') {
      setShowAdminForm(true);
    } else {
      onLogin('driver');
    }
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate authentication logic here
    if (username && password) {
      onLogin('admin');
    }
  };

  return (
    <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center px-4 overflow-hidden relative">
      {/* Background subtle glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-indigo-900/10 blur-3xl" />
      </div>

      <AnimatePresence mode="wait">
        {!showAdminForm ? (
          <motion.div
            key="role-selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, filter: "blur(5px)" }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center w-full max-w-2xl"
          >
            <div className="flex flex-col items-center mb-14 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center font-extrabold text-black text-2xl shadow-xl mb-5">
                P
              </div>
              <h1 className="text-4xl font-extrabold text-white tracking-tight">ParkGuard 2.0</h1>
              <p className="text-zinc-500 mt-2 text-sm tracking-widest font-medium uppercase">Secure Parking Management</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 w-full">
              {roles.map((role, i) => {
                const Icon = role.icon;
                return (
                  <motion.div
                    key={role.id}
                    data-card
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.15 * i + 0.1 }}
                    className={`flex-1 bg-white/5 backdrop-blur-xl rounded-2xl border ${role.accent} p-8 flex flex-col items-start gap-5 transition-all duration-300 cursor-pointer group hover:bg-white/10`}
                    onClick={() => handleRoleSelection(role.id)}
                  >
                    <div className={`p-4 rounded-xl ${role.iconBg}`}>
                      <Icon className={`w-8 h-8 ${role.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-xs font-bold tracking-widest text-zinc-500 uppercase mb-1">{role.subtitle}</p>
                      <h2 className="text-2xl font-extrabold text-white">{role.label}</h2>
                      <p className="text-zinc-400 text-sm mt-3 leading-relaxed">{role.description}</p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      className={`mt-auto w-full py-3 rounded-xl text-sm font-semibold transition-all ${role.btnClass} shadow-lg`}
                      onClick={(e) => { e.stopPropagation(); handleRoleSelection(role.id); }}
                    >
                      Continue as {role.label}
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-12 text-xs text-zinc-700"
            >
              © 2026 ParkGuard Systems. All rights reserved.
            </motion.p>
          </motion.div>
        ) : (
          <motion.div
            key="admin-login"
            initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md relative z-10"
          >
            <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] border border-indigo-500/30 p-8 pt-10 flex flex-col shadow-[0_0_40px_rgba(99,102,241,0.1)] relative overflow-hidden">
              {/* Top gradient highlight */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
              
              <button 
                onClick={() => setShowAdminForm(false)} 
                className="absolute top-5 left-5 p-2 text-zinc-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all"
                title="Back to roles"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center mb-8 mt-2">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner mb-5">
                  <ShieldCheck className="w-8 h-8 text-indigo-400" />
                </div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">Admin Access</h2>
                <p className="text-zinc-400 text-sm mt-1.5 text-center px-4">Authenticate to access the central management system</p>
              </div>
              
              <form className="flex flex-col gap-4" onSubmit={handleAdminSubmit}>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-indigo-400 text-zinc-500">
                     <User className="w-5 h-5 current-color" />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Username" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-medium shadow-inner" 
                  />
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-indigo-400 text-zinc-500">
                     <Lock className="w-5 h-5 current-color" />
                  </div>
                  <input 
                    type="password" 
                    placeholder="Password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-medium shadow-inner" 
                  />
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="mt-6 w-full py-4 rounded-xl text-sm font-bold text-white bg-indigo-500 hover:bg-indigo-400 transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.4)]"
                >
                  Authorize Entry
                </motion.button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

