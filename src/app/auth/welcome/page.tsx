"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { supabaseBrowser } from "@/utils/supabase/client";

type Project = {
  id: string;
  name: string;
  description: string | null;
};

function WelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [userProfile, setUserProfile] = useState<{ first_name: string | null; is_admin: boolean } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser;
    let timeoutId: NodeJS.Timeout;
    let isProcessing = false;
    
    async function handleInviteToken() {
      // Check for hash fragment (implicit flow: #access_token=...&type=invite)
      if (typeof window !== 'undefined' && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        
        if (accessToken && type === 'invite' && !isProcessing) {
          isProcessing = true;
          console.log('[Welcome] Processing implicit flow invite token');
          
          try {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
            
            if (error) {
              console.error('[Welcome] Session setup error:', error);
              setErrorMessage(`Failed to establish session: ${error.message}`);
              setIsLoading(false);
              return;
            }
            
            if (data.session) {
              console.log('[Welcome] Session established from implicit flow');
              setHasSession(true);
              loadUserData(data.session.user.id);
              
              // Clean up the hash from the URL
              window.history.replaceState(null, '', window.location.pathname);
            }
          } catch (err) {
            console.error('[Welcome] Unexpected error:', err);
            setErrorMessage('An unexpected error occurred. Please try again.');
            setIsLoading(false);
          }
          return;
        }
      }
      
      // Check for token_hash and type in query params (PKCE flow)
      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type');
      
      if (tokenHash && type === 'invite' && !isProcessing) {
        isProcessing = true;
        console.log('[Welcome] Processing PKCE invite token');
        
        try {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'invite',
          });
          
          if (error) {
            console.error('[Welcome] Token verification error:', error);
            setErrorMessage(`Failed to verify invite: ${error.message}`);
            setIsLoading(false);
            return;
          }
          
          if (data.session) {
            console.log('[Welcome] Session established from PKCE token');
            setHasSession(true);
            loadUserData(data.session.user.id);
          }
        } catch (err) {
          console.error('[Welcome] Unexpected error:', err);
          setErrorMessage('An unexpected error occurred. Please try again.');
          setIsLoading(false);
        }
      }
    }

    async function loadUserData(userId: string) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, is_admin')
          .eq('id', userId)
          .single();

        setUserProfile(profile);

        // Load projects for non-admin users
        if (profile && !profile.is_admin) {
          const { data: projectClients } = await supabase
            .from('project_clients')
            .select(`
              projects (
                id,
                name,
                description
              )
            `)
            .eq('client_id', userId);

          if (projectClients) {
            const projectData: Project[] = [];
            for (const pc of projectClients) {
              if (pc.projects && typeof pc.projects === 'object' && !Array.isArray(pc.projects)) {
                projectData.push(pc.projects as Project);
              }
            }
            setProjects(projectData);
          }
        }

        setIsLoading(false);
      } catch (err) {
        console.error('[Welcome] Error loading user data:', err);
        setIsLoading(false);
      }
    }
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Welcome] Auth state change:', event, !!session);
      
      if (session) {
        setHasSession(true);
        loadUserData(session.user.id);
        if (timeoutId) clearTimeout(timeoutId);
      }
    });
    
    // Check for existing session or handle invite token
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log('[Welcome] Existing session found');
        setHasSession(true);
        loadUserData(session.user.id);
      } else {
        // Try to handle implicit flow or PKCE flow
        handleInviteToken().then(() => {
          // If still no session after handling tokens, set timeout
          supabase.auth.getSession().then(({ data: { session: newSession } }) => {
            if (!newSession) {
              timeoutId = setTimeout(() => {
                setErrorMessage("Unable to establish session. The invite link may have expired.");
                setIsLoading(false);
              }, 5000);
            }
          });
        });
      }
    });
    
    return () => {
      subscription.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [searchParams]);

  const handleContinue = () => {
    if (userProfile?.is_admin) {
      router.push('/admin');
    } else if (projects.length === 1) {
      // Single project - go directly to it
      router.push(`/client/projects/${projects[0].id}`);
    } else {
      // Multiple projects - go to projects list
      router.push('/client');
    }
  };

  if (isLoading || !hasSession) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-pink-900 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-7 shadow-2xl sm:p-9">
          <p className="text-center text-white/80">Loading your account...</p>
        </div>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-pink-900 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-7 shadow-2xl sm:p-9">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-4">Unable to Sign In</h1>
            <p className="text-white/80 mb-6">{errorMessage}</p>
            <a
              href="/client/login"
              className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 px-6 py-3 text-sm font-bold text-white transition hover:scale-105"
            >
              Request New Login Link
            </a>
          </div>
        </div>
      </main>
    );
  }

  const displayName = userProfile?.first_name || 'there';

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-pink-900 px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-7 shadow-2xl sm:p-9">
        <div className="text-center mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-pink-300 mb-3">
            Welcome to LoveOnDev
          </p>
          <h1 className="text-4xl font-black tracking-tight text-white mb-4">
            Hi {displayName}! 👋
          </h1>
          <p className="text-lg text-white/90">
            You&apos;re all set and ready to go.
          </p>
        </div>

        {userProfile?.is_admin ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-3">Admin Access</h2>
            <p className="text-white/80 mb-4">
              You have full admin access to all projects and features. You can manage clients, projects, and view all activity.
            </p>
            <ul className="space-y-2 text-white/70 text-sm">
              <li>• Create and manage projects</li>
              <li>• Invite and manage clients</li>
              <li>• View all client feedback and comments</li>
              <li>• Access the admin dashboard</li>
            </ul>
          </div>
        ) : projects.length > 0 ? (
          <div className="space-y-4 mb-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-3">
                {projects.length === 1 ? 'Your Project' : 'Your Projects'}
              </h2>
              <p className="text-white/80 mb-4">
                You have access to {projects.length === 1 ? 'this project' : `${projects.length} projects`}:
              </p>
              <div className="space-y-3">
                {projects.map(project => (
                  <div key={project.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <h3 className="font-bold text-white mb-1">{project.name}</h3>
                    {project.description && (
                      <p className="text-white/70 text-sm">{project.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-3">What you can do</h2>
              <ul className="space-y-2 text-white/70 text-sm">
                <li>• View project progress and updates</li>
                <li>• Leave comments and feedback</li>
                <li>• Preview the live site as it&apos;s being built</li>
                <li>• Communicate directly with your development team</li>
                <li>• Track project milestones and deliverables</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-3">Getting Started</h2>
            <p className="text-white/80">
              You don&apos;t have any projects assigned yet. Your administrator will assign you to projects soon.
            </p>
          </div>
        )}

        <div className="bg-purple-500/20 border border-purple-400/50 rounded-xl p-6 mb-6">
          <h3 className="font-bold text-white mb-2">🔐 No passwords needed</h3>
          <p className="text-white/80 text-sm">
            When you want to sign in again, just enter your email address and we&apos;ll send you a magic link. 
            No passwords to remember!
          </p>
        </div>

        <div className="text-center">
          <button
            onClick={handleContinue}
            className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 px-8 py-4 text-base font-bold text-white transition hover:scale-105 shadow-lg"
          >
            {userProfile?.is_admin ? 'Go to Admin Dashboard' : projects.length === 1 ? `Go to ${projects[0].name}` : 'View My Projects'}
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-white/60 text-sm">
            Need help? Contact your administrator.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-pink-900 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-7 shadow-2xl sm:p-9">
          <p className="text-center text-white/80">Loading...</p>
        </div>
      </main>
    }>
      <WelcomeContent />
    </Suspense>
  );
}
