import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CreateTeam = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(true);
  const [existingTeamId, setExistingTeamId] = useState<string | null>(null);

  useEffect(() => {
    const checkOwnedTeam = async () => {
      if (!user) return setLoading(false);
      try {
        const { data, error } = await supabase
          .from('teams')
          .select('id, name')
          .eq('owner_id', user.id)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') throw error; // ignore no rows
        setExistingTeamId(data?.id || null);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    checkOwnedTeam();
  }, [user]);

  const myTeamId = existingTeamId;

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Please sign in to create a team.</p>
        </div>
      </div>
    );
  }

  if (!loading && myTeamId) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 space-y-4">
          <h1 className="text-2xl font-bold">Create a Team</h1>
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">You already own a team. For MVP, only one active team per coder.</p>
              <div className="mt-4">
                <Button onClick={() => navigate(`/team/${myTeamId}`)}>Go to my Team</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const onSubmit = () => {
    if (!name.trim()) return toast.error('Team name is required');
    if (name.trim().length < 3) return toast.error('Team name must be at least 3 characters');
    if (desc.length > 250) return toast.error('Description must be at most 250 characters');
    const run = async () => {
      try {
        // Ensure user still doesn't own a team
        const { data: mine } = await supabase
          .from('teams')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle();
        if (mine?.id) {
          toast.error('You already own a team');
          return;
        }

        const { data: newTeam, error } = await supabase
          .from('teams')
          .insert({
            name: name.trim(),
            logo_url: logoUrl.trim() || null,
            description: desc.trim() || null,
            owner_id: user.id,
          })
          .select('*')
          .single();
        if (error) throw error;

        // Add owner as a member
        const { error: memErr } = await supabase
          .from('team_members')
          .insert({ team_id: newTeam.id, user_id: user.id, role: 'Owner' });
        if (memErr) throw memErr;

        toast.success('Team created');
        navigate(`/team/${newTeam.id}`);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'Failed to create team');
      }
    };
    run();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Create a Team</h1>
        <Card>
          <CardHeader>
            <CardTitle>Team Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm">Team Name</label>
                <Input placeholder="e.g., Alpha Builders" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm">Team Logo URL (optional)</label>
                <Input placeholder="https://..." value={logoUrl} onChange={e => setLogoUrl(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm">Short Description</label>
              <Textarea placeholder="What does your team do? (max 250 chars)" maxLength={250} value={desc} onChange={e => setDesc(e.target.value)} />
              <div className="text-xs text-muted-foreground mt-1">{desc.length}/250</div>
            </div>
            <div className="flex justify-end">
              <Button onClick={onSubmit}>Create Team</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateTeam;
