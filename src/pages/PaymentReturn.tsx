import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

export default function PaymentReturn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const run = async () => {
      const status = searchParams.get('status');
      const projectId = searchParams.get('projectId');
      // In a real integration, verify via webhook or API using session ID
      if (!projectId) {
        setProcessing(false);
        setSuccess(false);
        setMessage('Missing project identifier.');
        return;
      }

      if (status !== 'success') {
        setProcessing(false);
        setSuccess(false);
        setMessage('Payment was canceled or failed.');
        return;
      }

      try {
        const endAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const { error } = await supabase
          .from('projects')
          .update({ paid: true as any, status: 'active' as any, bidding_end_time: endAt as any } as any)
          .eq('id', projectId);
        if (error) throw error;
        setSuccess(true);
        setMessage('Payment confirmed. Your project is now active and open for bidding.');
        toast.success('Project activated. Bidding is now open for 7 days.');
      } catch (e: any) {
        console.error(e);
        setSuccess(false);
        setMessage('We could not update your project after payment. Please contact support.');
      } finally {
        setProcessing(false);
      }
    };
    run();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-10 max-w-xl">
        <Card>
          <CardContent className="p-6 space-y-4">
            {processing ? (
              <p className="text-sm text-muted-foreground">Processing your payment…</p>
            ) : success ? (
              <>
                <h1 className="text-xl font-semibold">Payment Successful</h1>
                <p className="text-sm text-muted-foreground">{message}</p>
                <div className="pt-2">
                  <Button onClick={() => navigate('/projects')}>Go to Projects</Button>
                </div>
              </>
            ) : (
              <>
                <h1 className="text-xl font-semibold">Payment Not Completed</h1>
                <p className="text-sm text-muted-foreground">{message}</p>
                <div className="pt-2">
                  <Button variant="outline" onClick={() => navigate('/projects')}>Back to Projects</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
