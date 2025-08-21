import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, CheckCircle2, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

type Course = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
};

type Enrollment = {
  id: string;
  course_id: string;
  user_id: string;
  created_at: string;
  course?: Course;
};

const Study = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [enrolling, setEnrolling] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchCourses(), fetchEnrollments()]);
      setLoading(false);
    };
    init();
  }, [user?.id]);

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from('courses' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching courses:', error);
      toast.error('Failed to load courses');
    }
    setCourses((data as unknown as Course[]) || []);
  };

  const fetchEnrollments = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('course_enrollments' as any)
      .select('*, course:courses(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching enrollments:', error);
      toast.error('Failed to load enrolled courses');
    }
    setEnrollments((data as unknown as Enrollment[]) || []);
  };

  const isEnrolled = (courseId: string) => enrollments.some((e) => e.course_id === courseId);

  const handleEnroll = async (courseId: string) => {
    if (!user) {
      toast.error('Please sign in to enroll');
      return;
    }
    if (isEnrolled(courseId)) {
      toast.message('Already enrolled', { description: 'This course is in your list.' });
      return;
    }
    setEnrolling((prev) => ({ ...prev, [courseId]: true }));
    try {
      const { error } = await supabase
        .from('course_enrollments' as any)
        .insert({ course_id: courseId, user_id: user.id });
      if (error) throw error;
      toast.success('Enrolled successfully');
      await fetchEnrollments();
    } catch (err: any) {
      if (err?.code === '23505') {
        toast.message('Already enrolled');
      } else {
        console.error('Enroll error:', err);
        toast.error('Failed to enroll');
      }
    } finally {
      setEnrolling((prev) => ({ ...prev, [courseId]: false }));
    }
  };

  const filtered = courses.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-jakarta font-bold mb-1">Study</h1>
            <p className="text-foreground-muted">Discover courses and enroll to learn.</p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted w-4 h-4" />
            <Input
              placeholder="Search courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {loading && <div>Loading courses...</div>}
            {!loading && filtered.length === 0 && (
              <div className="text-foreground-muted">No courses found.</div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filtered.map((course) => (
                <Card key={course.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <BookOpen className="w-5 h-5" />
                          {course.title}
                        </CardTitle>
                      </div>
                      {isEnrolled(course.id) && (
                        <Badge variant="secondary" className="text-xs">Enrolled</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {course.description && (
                      <p className="text-sm text-foreground-muted line-clamp-3">{course.description}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex items-center"
                        onClick={() => handleEnroll(course.id)}
                        disabled={enrolling[course.id] || isEnrolled(course.id)}
                      >
                        {isEnrolled(course.id) ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Enrolled
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Enroll
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">My Enrolled Courses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {enrollments.length === 0 && (
                  <div className="text-sm text-foreground-muted">No enrollments yet.</div>
                )}
                {enrollments.map((en) => (
                  <div key={en.id} className="p-3 rounded-md border border-border flex items-start gap-3">
                    <BookOpen className="w-4 h-4 mt-1" />
                    <div>
                      <div className="font-medium text-sm">{en.course?.title}</div>
                      {en.course?.description && (
                        <div className="text-xs text-foreground-muted line-clamp-2">{en.course.description}</div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Study;
