import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Header } from '@/components/layout/Header';
import { Plus, DollarSign, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Database } from '@/integrations/supabase/types';

type Project = Database['public']['Tables']['projects']['Row'] & {
  project_skills: Array<{
    skills: {
      name: string;
      category: string;
    };
  }>;
  hirer: {
    full_name: string;
    avatar_url: string | null;
  };
};

const Projects = () => {
  const { user, profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [bidAmount, setBidAmount] = useState<string>('');
  const [experienceYears, setExperienceYears] = useState<string>('');
  const [applicationMessage, setApplicationMessage] = useState<string>('');
  // Apply as individual or team
  const [applyMode, setApplyMode] = useState<'individual' | 'team'>('individual');
  const [ownedTeams, setOwnedTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  interface ProjectApplication {
    id: string;
    message: string;
    status: string;
    created_at: string;
    coder_id: string;
    project_id: string;
    bid_amount?: number | null;
    experience_years?: number | null;
    profiles: {
      id: string;
      full_name: string;
      email: string;
      avatar_url: string | null;
      bio: string | null;
    } | null;
  }

  const [projectApplications, setProjectApplications] = useState<ProjectApplication[]>([]);

  // Function to update application status and send notification
  const updateApplicationStatus = async (applicationId: string, status: 'accepted' | 'rejected') => {
    try {
      // Update the application status
      const { data, error } = await supabase
        .from('project_applications')
        .update({ status })
        .eq('id', applicationId)
        .select()
        .single();

      if (error) throw error;

      // Get the application details for notification
      const { data: appWithDetails } = await supabase
        .from('project_applications')
        .select('*, projects!inner(title)')
        .eq('id', applicationId)
        .single();

      if (appWithDetails) {
        try {
          console.log('App with details:', appWithDetails);

          // First, verify we have the required data
          if (!appWithDetails.coder_id) {
            throw new Error('Missing coder_id in application');
          }
          if (!appWithDetails.project_id) {
            throw new Error('Missing project_id in application');
          }

          // Get project title
          const projectTitle = appWithDetails.projects?.title || 'a project';
          const notificationTitle = `Application ${status.charAt(0).toUpperCase() + status.slice(1)}`;
          const notificationMessage = `Your application for project "${projectTitle}" has been ${status}.`;

          console.log('Sending notification with:', {
            user_id: appWithDetails.coder_id,
            title: notificationTitle,
            message: notificationMessage,
            type: status
          });

          // Use the database function to send notification
          const { data, error } = await supabase.rpc('send_notification', {
            p_user_id: appWithDetails.coder_id,
            p_title: notificationTitle,
            p_message: notificationMessage,
            p_type: status,
            p_related_id: appWithDetails.project_id
          });

          if (error) {
            console.error('Database function error:', error);
            throw error;
          }

          if (!data?.success) {
            console.error('Notification function returned error:', data);
            throw new Error(data?.error || 'Failed to send notification');
          }

          console.log('Notification sent successfully:', data);

        } catch (notifErr) {
          console.error('Error in notification process:', notifErr);
          // Don't fail the whole operation if notification fails
          toast.error('Application updated, but there was an issue sending the notification');
        }
      }

      // Refresh the applications list
      if (selectedProject) {
        const updatedApplications = await fetchProjectApplications(selectedProject.id);
        setProjectApplications(updatedApplications);
      }

      toast.success(`Application ${status} successfully`);
      return data;
    } catch (error) {
      console.error(`Error ${status}ing application:`, error);
      toast.error(`Failed to ${status} application`);
      return null;
    }
  };

  // Function to handle accepting an application
  const handleAcceptApplication = async (applicationId: string) => {
    return updateApplicationStatus(applicationId, 'accepted');
  };

  // Function to handle rejecting an application
  const handleRejectApplication = async (applicationId: string) => {
    return updateApplicationStatus(applicationId, 'rejected');
  };

  // Submit application with bid and experience fields from dialog
  const handleSubmitApplication = async () => {
    if (!user || !selectedProject) return;

    const bid = bidAmount ? parseFloat(bidAmount) : null;
    const exp = experienceYears ? parseInt(experienceYears, 10) : null;

    if (bid !== null && (isNaN(bid) || bid < 0)) {
      toast.error('Please enter a valid bid amount');
      return;
    }
    if (exp !== null && (isNaN(exp) || exp < 0)) {
      toast.error('Please enter valid years of experience');
      return;
    }

    try {
      // Enforce team owner rule
      if (applyMode === 'team') {
        if (!selectedTeamId) {
          toast.error('Select a team to apply as');
          return;
        }
        const ownsTeam = ownedTeams.some(t => t.id === selectedTeamId);
        if (!ownsTeam) {
          toast.error('Only the team owner can apply on behalf of a team');
          return;
        }
      }

      const teamPrefix = applyMode === 'team'
        ? (() => {
          const t = ownedTeams.find(t => t.id === selectedTeamId);
          return t ? `[Applied as Team: ${t.name} | ${t.id}]\n` : '[Applied as Team]\n';
        })()
        : '';

      const { error } = await supabase
        .from('project_applications')
        .insert({
          project_id: selectedProject.id,
          coder_id: user.id,
          message: `${teamPrefix}${applicationMessage || 'I would like to apply for this project.'}`,
          status: 'pending',
          bid_amount: bid,
          experience_years: exp,
        } as any)
        .select()
        .single();

      if (error) throw error;

      toast.success('Application submitted successfully!');
      setIsApplyOpen(false);
      setBidAmount('');
      setExperienceYears('');
      setApplicationMessage('');
      setApplyMode('individual');
      setSelectedTeamId('');

      await Promise.all([fetchProjects(), fetchMyApplications()]);
    } catch (err: any) {
      console.error('Error submitting application:', err);
      if (err?.code === '23505') {
        toast.error('You have already applied to this project');
      } else {
        toast.error('Failed to submit application. Please try again.');
      }
    }
  };

  useEffect(() => {
    if (user) {
      fetchProjects();
      if (profile?.role === 'hirer') {
        fetchMyProjects();
      } else if (profile?.role === 'coder') {
        fetchMyApplications();
      }
    }
  }, [user, profile]);

  // Load teams owned by the user for team applications
  useEffect(() => {
    const loadOwnedTeams = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .eq('owner_id', user.id)
        .order('name', { ascending: true });
      if (!error && data) setOwnedTeams(data as any);
    };
    loadOwnedTeams();
  }, [user]);

  const fetchProjects = async () => {
    // First try including new 'active' status (post-migration). If enum isn't updated yet, fallback to 'open' only.
    const baseSelect = () => supabase
      .from('projects')
      .select(`
        *,
        project_skills(
          skills(name, category)
        ),
        hirer:profiles!projects_hirer_id_fkey(full_name, avatar_url)
      `);

    let data: any = null;
    let error: any = null;

    // Attempt with ['open','active']
    ({ data, error } = await baseSelect()
      .in('status', ['open', 'active'] as any)
      .order('created_at', { ascending: false }));

    // If enum 'active' not present (22P02 invalid input value), fallback to 'open' only
    if (error && (error.code === '22P02' || error.message?.includes('invalid input value for enum'))) {
      ({ data, error } = await baseSelect()
        .eq('status', 'open')
        .order('created_at', { ascending: false }));
    }

    if (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
      return;
    }

    setProjects(data as Project[]);
    setLoading(false);
  };

  const fetchMyProjects = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_skills(
          skills(name, category)
        ),
        hirer:profiles!projects_hirer_id_fkey(full_name, avatar_url)
      `)
      .eq('hirer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching my projects:', error);
      return;
    }

    setMyProjects(data as Project[]);
  };

  const formatBudget = (min: number | null, max: number | null) => {
    if (!min && !max) return 'Budget not specified';
    if (min && max) return `$${min} - $${max}`;
    if (min) return `From $${min}`;
    if (max) return `Up to $${max}`;
    return 'Budget not specified';
  };

  const getBudgetText = (p: any) => {
    if (p?.budget != null) {
      return `$${p.budget}`;
    }
    return formatBudget(p?.budget_min ?? null, p?.budget_max ?? null);
  };

  const getBiddingInfo = (p: any) => {
    const endIso = p?.bidding_end_time as string | null;
    if (!endIso) return { text: null, isClosed: false };
    const end = new Date(endIso).getTime();
    const now = Date.now();
    const diff = end - now;
    if (diff <= 0) return { text: 'Bidding closed', isClosed: true };
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    const parts = [days ? `${days}d` : null, hours ? `${hours}h` : null, mins ? `${mins}m` : null].filter(Boolean);
    return { text: `Bidding ends in ${parts.join(' ') || 'less than 1m'}`, isClosed: false };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-success text-success-foreground';
      case 'active': return 'bg-success text-success-foreground';
      case 'in_progress': return 'bg-warning text-warning-foreground';
      case 'closed': return 'bg-muted text-muted-foreground';
      case 'draft': return 'bg-muted text-muted-foreground';
      case 'completed': return 'bg-primary text-primary-foreground';
      case 'cancelled': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const ProjectCard = ({ project, showActions = false }: { project: Project; showActions?: boolean }) => {
    const { profile, user } = useAuth();

    const handleViewDetails = async () => {
      setSelectedProject(project);
      setIsDetailsOpen(true);
      if (profile?.role === 'hirer') {
        const apps = await fetchProjectApplications(project.id);
        setProjectApplications(apps);
      }
    };

    const handleApplyClick = async () => {
      if (!user) {
        toast.error('Please log in to apply for projects');
        return;
      }

      // Open the application form dialog
      setSelectedProject(project);
      setIsApplyOpen(true);
    };

    return (
      <Card className="hover-lift">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{project.title}</CardTitle>
              <p className="text-sm text-foreground-muted">by {project.hirer.full_name}</p>
            </div>
            <Badge className={getStatusColor(project.status)}>
              {project.status.replace('_', ' ')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-foreground-muted" />
                <span className="text-sm">{getBudgetText(project as any)}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-foreground-muted" />
                <span className="text-sm">{(project as any).timeline_date || project.timeline || 'Flexible'}</span>
              </div>
            </div>

            {project.status === 'active' && (project as any).bidding_end_time && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{getBiddingInfo(project as any).text}</span>
              </div>
            )}

            {project.description && (
              <p className="text-sm text-foreground-muted line-clamp-3">
                {project.description}
              </p>
            )}

            {project.project_skills?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {project.project_skills.map(({ skills }) => (
                  <Badge key={skills.name} variant="outline" className="text-xs">
                    {skills.name}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-foreground-muted">
                Posted {new Date(project.created_at).toLocaleDateString()}
              </span>
              <div className="flex space-x-2">
                {showActions && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleViewDetails}
                    >
                      View Details
                    </Button>
                    {profile?.role === 'coder' && (() => {
                      const { isClosed } = getBiddingInfo(project as any);
                      const canApply = (project.status === 'active' || project.status === 'open') && !isClosed;
                      return (
                        <Button
                          size="sm"
                          onClick={handleApplyClick}
                          disabled={!canApply}
                          title={!canApply ? 'Bidding is closed' : 'Apply to this project'}
                        >
                          {canApply ? 'Apply Now' : 'Bidding Closed'}
                        </Button>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const handleApplyToProject = async (projectId: string) => {
    if (!user) {
      console.error('No user logged in');
      return;
    }

    console.log('Applying to project:', projectId, 'for user:', user.id);

    try {
      const { data, error } = await supabase
        .from('project_applications')
        .insert({
          project_id: projectId,
          coder_id: user.id,
          message: 'I would like to apply for this project.',
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('Error applying to project:', error);
        if (error.code === '23505') {
          toast.error('You have already applied to this project');
        } else {
          toast.error('Failed to apply to project');
        }
        return;
      }

      console.log('Application successful, data:', data);
      toast.success('Application submitted successfully');

      // Refresh both projects and applications
      await Promise.all([
        fetchProjects(),
        fetchMyApplications()
      ]);

    } catch (err) {
      console.error('Unexpected error in handleApply:', err);
      toast.error('An error occurred while applying');
    }
  };

  const fetchMyApplications = async () => {
    if (!user) {
      console.log('No user found, cannot fetch applications');
      return;
    }

    console.log('=== START: Fetching applications for user:', user.id);

    try {
      // First, verify the user exists in the profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single();

      if (profileError || !profileData) {
        console.error('Error fetching user profile:', profileError);
        toast.error('Error loading your profile');
        return;
      }

      console.log('User profile found:', profileData);

      // First, get all applications for the user
      console.log('Fetching applications from database...');
      const { data: applications, error: appsError } = await supabase
        .from('project_applications')
        .select('*')
        .eq('coder_id', user.id)
        .order('created_at', { ascending: false });

      if (appsError) {
        console.error('Error fetching applications:', appsError);
        throw appsError;
      }

      if (!applications || applications.length === 0) {
        console.log('No applications found for user');
        setApplications([]);
        return;
      }

      // Get unique project IDs from applications
      const projectIds = [...new Set(applications.map(app => app.project_id))];

      // Fetch project details for these applications
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          title,
          hirer:profiles!projects_hirer_id_fkey(
            id,
            full_name,
            avatar_url
          )
        `)
        .in('id', projectIds);

      if (projectsError) {
        console.error('Error fetching projects:', projectsError);
        throw projectsError;
      }

      // Combine the data
      const combinedData = applications.map(app => {
        const project = projectsData?.find(p => p.id === app.project_id);
        return {
          ...app,
          projects: project || null
        };
      });

      console.log('Successfully fetched and combined application data:', combinedData);
      setApplications(combinedData);

    } catch (err) {
      console.error('Unexpected error in fetchMyApplications:', err);
      toast.error('An error occurred while loading your applications');
    } finally {
      console.log('=== END: Finished fetching applications ===');
    }
  };

  const fetchProjectApplications = async (projectId: string) => {
    try {
      console.log('Fetching applications for project:', projectId);

      // First, get the applications
      const { data: applications, error: appsError } = await supabase
        .from('project_applications')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (appsError) {
        console.error('Error fetching applications:', appsError);
        throw appsError;
      }

      if (!applications?.length) {
        console.log('No applications found for project:', projectId);
        return [];
      }

      console.log('Found applications:', applications);

      // Get unique coder IDs from applications
      const coderIds = [...new Set(applications.map(app => app.coder_id))];
      console.log('Fetching profiles for coder IDs:', coderIds);

      // Get profiles in batches if needed (Supabase has a limit on IN clause)
      const batchSize = 50;
      let allProfiles: any[] = [];

      for (let i = 0; i < coderIds.length; i += batchSize) {
        const batch = coderIds.slice(i, i + batchSize);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', batch);

        if (profilesError) {
          console.error('Error fetching profiles batch:', profilesError);
          throw profilesError;
        }

        if (profiles) {
          allProfiles = [...allProfiles, ...profiles];
        }
      }

      console.log('Found profiles:', allProfiles);

      // Combine the data
      const result = applications.map(app => {
        const profile = allProfiles.find(p => p.id === app.coder_id) || null;
        return {
          ...app,
          profiles: profile ? {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            avatar_url: profile.avatar_url,
            bio: profile.bio
          } : null
        };
      });

      console.log('Final result:', result);
      return result;

    } catch (error) {
      console.error('Error in fetchProjectApplications:', error);
      toast.error('Failed to load applications. Please try again.');
      return [];
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-foreground-muted">Please log in to view projects.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        {/* Apply Dialog */}
        <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
          <DialogContent className="max-w-lg" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>Apply to {selectedProject?.title || 'Project'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Apply as selector */}
              <div className="space-y-2">
                <Label>Apply as</Label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="applyMode"
                      value="individual"
                      checked={applyMode === 'individual'}
                      onChange={() => setApplyMode('individual')}
                    />
                    Individual
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="applyMode"
                      value="team"
                      checked={applyMode === 'team'}
                      onChange={() => setApplyMode('team')}
                    />
                    Team (owner only)
                  </label>
                </div>
                {applyMode === 'team' && (
                  <div className="space-y-2">
                    <Label htmlFor="teamSelect">Select your team</Label>
                    <select
                      id="teamSelect"
                      className="w-full border rounded px-3 py-2 bg-background"
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                    >
                      <option value="">-- Choose a team you own --</option>
                      {ownedTeams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    {ownedTeams.length === 0 && (
                      <p className="text-xs text-muted-foreground">You don't own any teams. Create a team to apply as a team.</p>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="bidAmount">Your bid amount (USD)</Label>
                <Input
                  id="bidAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 500"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="experienceYears">Years of experience</Label>
                <Input
                  id="experienceYears"
                  type="number"
                  min="0"
                  placeholder="e.g. 3"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="applicationMessage">Message</Label>
                <Textarea
                  id="applicationMessage"
                  placeholder="Tell the hirer why you're a great fit."
                  value={applicationMessage}
                  onChange={(e) => setApplicationMessage(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsApplyOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmitApplication}>Submit Application</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {/* Project Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="w-[90vw] max-w-5xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
            {selectedProject && (
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Left column - Project details */}
                <div className="flex-1 space-y-4">
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="text-lg font-semibold mb-2">Description</h3>
                      <p className="whitespace-pre-line text-foreground-muted">{selectedProject.description}</p>
                    </CardContent>
                  </Card>
                  
                  {selectedProject.project_skills && selectedProject.project_skills.length > 0 && (
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="text-lg font-semibold mb-2">Required Skills</h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedProject.project_skills.map((s: any, i: number) => (
                            <Badge key={i} variant="secondary">{s.skills.name}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Right column - Applications */}
                {profile?.role === 'hirer' && (
                  <div className="w-full lg:w-[400px] space-y-4">
                    <Card className="sticky top-4">
                      <CardContent className="p-6">
                        <h3 className="text-lg font-semibold mb-4">Applications ({projectApplications.length})</h3>
                        <div className="space-y-4">
                          {projectApplications.length === 0 ? (
                            <p className="text-sm text-foreground-muted">No applications yet.</p>
                          ) : (
                            projectApplications.map((app) => {
                              const profile = app.profiles as any; // Temporary type assertion
                              return (
                                <div key={app.id} className="space-y-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                                  <div className="flex items-start space-x-4">
                                    <Avatar className="h-12 w-12 mt-1">
                                      <AvatarImage src={profile?.avatar_url} alt={profile?.full_name} />
                                      <AvatarFallback className="text-lg">{profile?.full_name?.[0] || 'U'}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-medium text-base">{profile?.full_name || 'Unknown User'}</h4>
                                      <p className="text-sm text-muted-foreground truncate">{profile?.email}</p>
                                    </div>
                                  </div>
                                  {app.message && (
                                    <div className="mt-2 p-3 bg-muted/20 rounded-md border border-border">
                                      <p className="text-sm text-foreground/90 leading-relaxed">{app.message}</p>
                                    </div>
                                  )}
                                  {(app.bid_amount != null || app.experience_years != null) && (
                                    <div className="flex items-center gap-4 text-sm text-foreground/90">
                                      {app.bid_amount != null && (
                                        <div className="flex items-center gap-1">
                                          <DollarSign className="h-4 w-4 text-foreground-muted" />
                                          <span>Bid: ${app.bid_amount}</span>
                                        </div>
                                      )}
                                      {app.experience_years != null && (
                                        <div className="flex items-center gap-1">
                                          <Users className="h-4 w-4 text-foreground-muted" />
                                          <span>Experience: {app.experience_years} {app.experience_years === 1 ? 'year' : 'years'}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/50">
                                    <div className="flex items-center space-x-2">
                                      <Badge 
                                        variant={app.status === 'pending' ? 'outline' : app.status === 'accepted' ? 'default' : 'destructive'}
                                        className="text-xs py-1 px-2.5"
                                      >
                                        {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                                      </Badge>
                                    </div>
                                    {app.status === 'pending' && (
                                      <div className="space-x-2">
                                        <Button 
                                          size="sm" 
                                          variant="outline" 
                                          className="h-8 px-3 text-xs"
                                          onClick={() => handleRejectApplication(app.id)}
                                        >
                                          Reject
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          className="h-8 px-3 text-xs"
                                          onClick={() => handleAcceptApplication(app.id)}
                                        >
                                          Accept
                                        </Button>
                                      </div>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(app.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Projects</h1>
            <p className="text-foreground-muted">
              {profile?.role === 'coder' 
                ? 'Find exciting projects to work on' 
                : 'Manage your projects and find talented coders'
              }
            </p>
          </div>
          {profile?.role === 'hirer' && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Post Project
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Post a New Project</DialogTitle>
                </DialogHeader>
                <ProjectForm 
                  onSuccess={() => {
                    setIsCreateDialogOpen(false);
                    fetchMyProjects();
                  }}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Tabs defaultValue="browse" className="w-full">
          <TabsList className={`grid w-full ${profile?.role === 'hirer' ? 'grid-cols-2' : profile?.role === 'coder' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <TabsTrigger value="browse">Browse Projects</TabsTrigger>
            {profile?.role === 'hirer' && (
              <TabsTrigger value="my-projects">My Projects</TabsTrigger>
            )}
            {profile?.role === 'coder' && (
              <TabsTrigger value="my-applications">My Applications</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="browse" className="mt-6">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="h-3 bg-muted rounded"></div>
                        <div className="h-3 bg-muted rounded w-5/6"></div>
                        <div className="h-3 bg-muted rounded w-4/6"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-foreground-muted mb-4">No projects available at the moment.</p>
                {profile?.role === 'hirer' && (
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Post the First Project
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} showActions={true} />
                ))}
              </div>
            )}
          </TabsContent>

          {profile?.role === 'hirer' && (
            <TabsContent value="my-projects" className="mt-6">
              {myProjects.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-foreground-muted mb-4">You haven't posted any projects yet.</p>
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Post Your First Project
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} showActions />
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {profile?.role === 'coder' && (
            <TabsContent value="my-applications" className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">My Applications</h2>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={fetchMyApplications}
                >
                  Refresh
                </Button>
              </div>
              
              {applications.length === 0 ? (
                <div className="text-center py-12 border rounded-lg">
                  <p className="text-foreground-muted mb-4">You haven't applied to any projects yet.</p>
                  <Button onClick={() => document.querySelector('[value="browse"]')?.click()}>
                    Browse Projects
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {applications.map((application) => {
                    const project = application.projects;
                    if (!project) {
                      console.warn('Missing project data for application:', application.id);
                      return null;
                    }
                    
                    return (
                      <Card key={application.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg mb-2">
                                {project.title || 'Untitled Project'}
                              </h3>
                              {project.hirer && (
                                <div className="flex items-center text-sm text-foreground-muted mb-2">
                                  <span>by {project.hirer.full_name || 'Unknown'}</span>
                                </div>
                              )}
                              {application.message && (
                                <div className="bg-muted/50 p-3 rounded-md mb-3">
                                  <p className="text-foreground">{application.message}</p>
                                </div>
                              )}
                              {(application.bid_amount != null || application.experience_years != null) && (
                                <div className="flex items-center gap-4 text-sm text-foreground/90 mb-2">
                                  {application.bid_amount != null && (
                                    <div className="flex items-center gap-1">
                                      <DollarSign className="h-4 w-4 text-foreground-muted" />
                                      <span>Bid: ${application.bid_amount}</span>
                                    </div>
                                  )}
                                  {application.experience_years != null && (
                                    <div className="flex items-center gap-1">
                                      <Users className="h-4 w-4 text-foreground-muted" />
                                      <span>Experience: {application.experience_years} {application.experience_years === 1 ? 'year' : 'years'}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              <div className="flex items-center justify-between mt-3">
                                <p className="text-xs text-foreground-muted">
                                  Applied on {new Date(application.created_at).toLocaleDateString()}
                                </p>
                                <Badge 
                                  variant={
                                    application.status === 'pending' ? 'secondary' :
                                    application.status === 'accepted' ? 'default' : 'destructive'
                                  }
                                  className="ml-2"
                                >
                                  {application.status}
                                </Badge>
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                const projectId = project.id;
                                if (projectId) {
                                  // Find and select the project to view details
                                  const proj = projects.find(p => p.id === projectId);
                                  if (proj) {
                                    setSelectedProject(proj);
                                    setIsDetailsOpen(true);
                                  }
                                }
                              }}
                            >
                              View Project
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default Projects;