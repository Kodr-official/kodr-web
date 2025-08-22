import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import { openLemonCheckout } from '@/lib/lemon';

type Skill = Database['public']['Tables']['skills']['Row'];

interface ProjectFormProps {
  onSuccess: () => void;
}

export function ProjectForm({ onSuccess }: ProjectFormProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [timelineDate, setTimelineDate] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [skillSelectValue, setSkillSelectValue] = useState<string>("");
  const [hirePreference, setHirePreference] = useState<"individual" | "team" | "either">("either");

  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .order('category', { ascending: true });

    if (error) {
      console.error('Error fetching skills:', error);
      return;
    }

    setAvailableSkills(data || []);
  };

  const handleOpenCheckout = () => {
    if (!createdProjectId) {
      toast.error('Project not created yet');
      return;
    }
    try {
      openLemonCheckout(createdProjectId, title);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Checkout is not configured');
    }
  };

  const addSkill = (skillId: string) => {
    const skill = availableSkills.find(s => s.id === skillId);
    if (skill && !selectedSkills.find(s => s.id === skillId)) {
      setSelectedSkills([...selectedSkills, skill]);
    }
    setSkillSelectValue("");
  };

  const removeSkill = (skillId: string) => {
    setSelectedSkills(selectedSkills.filter(s => s.id !== skillId));
  };

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!title.trim() || !description.trim()) {
      toast.error('Title and description are required');
      return;
    }

    setIsLoading(true);
    try {
      const skillsRequired = selectedSkills.map(s => s.name);
      // Attempt minimal insert compatible with old schema
      let project: any = null;
      let projectError: any = null;
      ({ data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          hirer_id: user.id,
          title,
          description: `[Hire Preference: ${hirePreference}]\n\n${description}`,
        } as any)
        .select()
        .single());

      // Do NOT set status to 'open' here; keep as draft/default until payment.

      if (projectError) throw projectError;

      // Optionally also persist linkage to existing skills table for discovery
      if (selectedSkills.length > 0) {
        const projectSkills = selectedSkills.map(skill => ({
          project_id: project.id,
          skill_id: skill.id
        }));
        const { error: skillsError } = await supabase
          .from('project_skills')
          .insert(projectSkills);
        if (skillsError) console.warn('project_skills insert warning:', skillsError.message);
      }

      setCreatedProjectId(project.id);
      setStep(2);
      toast.success('Draft saved. Proceed to payment.');
    } catch (error) {
      console.error('Error creating draft project:', error);
      toast.error('Failed to save draft');
    } finally {
      setIsLoading(false);
    }
  };

  // Removed test activation without payment

  return (
    <form onSubmit={handleCreateDraft} className="space-y-6">
      {step === 1 && (
      <>
      <div>
        <Label htmlFor="title">Project Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter project title"
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your project requirements, goals, and expectations..."
          rows={4}
          required
        />
      </div>

      <div>
        <Label htmlFor="budget">Budget (USD)</Label>
        <Input
          id="budget"
          type="number"
          min="0"
          step="0.01"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="e.g., 1000"
        />
      </div>

      <div>
        <Label htmlFor="timelineDate">Timeline (deadline)</Label>
        <Input
          id="timelineDate"
          type="date"
          value={timelineDate}
          onChange={(e) => setTimelineDate(e.target.value)}
        />
      </div>

      <div>
        <Label>Who are you looking to hire?</Label>
        <Select value={hirePreference} onValueChange={(v) => setHirePreference(v as any)}>
          <SelectTrigger>
            <SelectValue placeholder="Select preference" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="individual">Individual coder</SelectItem>
            <SelectItem value="team">Whole team</SelectItem>
            <SelectItem value="either">Either</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Required Skills</Label>
        <Select value={skillSelectValue} onValueChange={addSkill}>
          <SelectTrigger>
            <SelectValue placeholder="Add a skill" />
          </SelectTrigger>
          <SelectContent>
            {availableSkills
              .filter(skill => !selectedSkills.find(s => s.id === skill.id))
              .map((skill) => (
                <SelectItem key={skill.id} value={skill.id}>
                  {skill.name} ({skill.category})
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        
        {selectedSkills.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {selectedSkills.map((skill) => (
              <Badge key={skill.id} variant="secondary" className="flex items-center gap-1">
                {skill.name}
                <button
                  type="button"
                  onClick={() => removeSkill(skill.id)}
                  className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

    <div className="flex justify-end space-x-3">
      <Button type="button" variant="outline" onClick={onSuccess}>
        Cancel
      </Button>
      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'Saving…' : 'Save & Continue to Payment'}
      </Button>
    </div>
    </>
    )}

    {step === 2 && (
      <div className="space-y-4">
        <div className="p-4 border rounded-md bg-muted/30">
          <p className="text-sm text-muted-foreground">Project draft created. To open bidding, complete the payment.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => setStep(1)}>
            Back
          </Button>
          <Button type="button" variant="default" onClick={handleOpenCheckout} disabled={isLoading}>
            Pay & Activate via Lemon Squeezy
          </Button>
        </div>
      </div>
    )}
  </form>
);
}