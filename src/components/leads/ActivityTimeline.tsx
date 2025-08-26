import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LeadActivity, EmailThread, CallLog } from '@/types/lead';
import { formatDistanceToNow } from 'date-fns';
import { 
  Activity, 
  Mail, 
  Phone, 
  Calendar, 
  MessageSquare, 
  Clock,
  PhoneCall,
  Plus,
  Filter,
  Quote,
  Package,
  Image,
  FileText
} from 'lucide-react';
import EmailThreadDialog from './EmailThreadDialog';

interface ActivityTimelineProps {
  leadId: string;
  filterType?: 'activity' | 'communication';
}

// Remove demo content — show only real activities fetched elsewhere
const mockActivities: LeadActivity[] = [];

export default function ActivityTimeline({ leadId, filterType }: ActivityTimelineProps) {
  const [activities] = useState<LeadActivity[]>(mockActivities);
  const [selectedEmailThread, setSelectedEmailThread] = useState(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'meeting':
        return <Calendar className="h-4 w-4" />;
      case 'note':
        return <MessageSquare className="h-4 w-4" />;
      case 'quote':
        return <Quote className="h-4 w-4" />;
      case 'logo_upload':
        return <Image className="h-4 w-4" />;
      case 'product_selection':
        return <Package className="h-4 w-4" />;
      case 'form_submission':
        return <FileText className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const handleViewEmailThread = (emailThread: any) => {
    setSelectedEmailThread(emailThread);
    setEmailDialogOpen(true);
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'email':
        return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'call':
        return 'bg-green-100 text-green-600 border-green-200';
      case 'meeting':
        return 'bg-purple-100 text-purple-600 border-purple-200';
      case 'note':
        return 'bg-yellow-100 text-yellow-600 border-yellow-200';
      case 'quote':
        return 'bg-emerald-100 text-emerald-600 border-emerald-200';
      case 'logo_upload':
        return 'bg-violet-100 text-violet-600 border-violet-200';
      case 'product_selection':
        return 'bg-orange-100 text-orange-600 border-orange-200';
      case 'form_submission':
        return 'bg-sky-100 text-sky-600 border-sky-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const formatCallDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // No demo additions
  const additionalActivities: LeadActivity[] = [];

  const filteredActivities = [...activities, ...additionalActivities]
    .filter(a => a.leadId === leadId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Activity & Communication
        </h3>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Log Activity
          </Button>
        </div>
      </div>

      {/* Activities List */}
      <div className="mt-4">
        <div className="space-y-4">
          {filteredActivities.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No {filterType === 'communication' ? 'communications' : 'activities'} found.
              </CardContent>
            </Card>
          ) : (
            filteredActivities.map((activity, index) => (
                <Card key={activity.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-4">
                      {/* Activity Icon */}
                      <div className={`
                        p-2 rounded-full border
                        ${getActivityColor(activity.type)}
                      `}>
                        {getActivityIcon(activity.type)}
                      </div>

                      {/* Activity Content */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{activity.title}</h4>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="capitalize">
                              {activity.type}
                            </Badge>
                            <span className="text-sm text-muted-foreground flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                            </span>
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground mb-3">
                          {activity.description}
                        </p>

                        {/* Activity-specific content */}
                        {activity.type === 'email' && activity.metadata?.emailThread && (
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                📧 {activity.metadata.emailThread.subject}
                              </span>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleViewEmailThread(activity.metadata.emailThread)}
                              >
                                View Thread
                              </Button>
                            </div>
                          </div>
                        )}

                        {activity.type === 'quote' && activity.metadata && (
                          <div className={`p-3 rounded-lg ${activity.metadata.isAiGenerated ? 'bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200' : 'bg-muted/50'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                {activity.metadata.isAiGenerated && (
                                  <div className="flex items-center space-x-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                                    <span className="w-3 h-3 bg-white rounded-full flex items-center justify-center">
                                      <span className="w-1.5 h-1.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></span>
                                    </span>
                                    AI Generated
                                  </div>
                                )}
                                <span className="text-sm font-medium">
                                  💰 Quote #{activity.metadata.quoteId}
                                </span>
                              </div>
                              <span className="text-sm font-semibold">
                                ${activity.metadata.totalAmount}
                              </span>
                            </div>
                            {activity.metadata.isAiGenerated && (
                              <div className="flex items-center space-x-4 mb-2 text-xs">
                                <div className="flex items-center space-x-1">
                                  <span className="text-blue-600">🎯 Confidence:</span>
                                  <span className="font-medium">{activity.metadata.aiConfidence}%</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <span className="text-purple-600">⚡ Auto-sent to customer</span>
                                </div>
                              </div>
                            )}
                            {activity.metadata.products && (
                              <div className="text-xs text-muted-foreground">
                                Products: {activity.metadata.products.join(', ')}
                              </div>
                            )}
                            <div className="flex justify-end mt-2">
                              <Button variant="ghost" size="sm">
                                View Quote
                              </Button>
                            </div>
                          </div>
                        )}

                        {activity.type === 'form_submission' && activity.metadata && (
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                📄 {activity.metadata.fileName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {activity.metadata.fileSize}
                              </span>
                            </div>
                            <div className="flex justify-end mt-2">
                              <Button variant="ghost" size="sm">View PO</Button>
                            </div>
                          </div>
                        )}

                        {activity.type === 'logo_upload' && activity.metadata && (
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                🖼️ {activity.metadata.fileName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {activity.metadata.fileSize}
                              </span>
                            </div>
                          </div>
                        )}

                        {activity.type === 'call' && activity.metadata?.callLog && (
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium">Duration:</span>{' '}
                                {formatCallDuration(activity.metadata.callLog.duration)}
                              </div>
                              <div>
                                <span className="font-medium">Direction:</span>{' '}
                                <Badge variant="outline" className="ml-1 capitalize">
                                  {activity.metadata.callLog.direction}
                                </Badge>
                              </div>
                              <div>
                                <span className="font-medium">Outcome:</span>{' '}
                                <Badge variant="outline" className="ml-1 capitalize">
                                  {activity.metadata.callLog.outcome}
                                </Badge>
                              </div>
                            </div>
                            {activity.metadata.callLog.notes && (
                              <div className="mt-2 text-sm">
                                <span className="font-medium">Notes:</span>{' '}
                                {activity.metadata.callLog.notes}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button variant="outline" size="sm" className="justify-start">
              <Mail className="h-4 w-4 mr-2" />
              Send Email
            </Button>
            <Button variant="outline" size="sm" className="justify-start">
              <PhoneCall className="h-4 w-4 mr-2" />
              Log Call
            </Button>
            <Button variant="outline" size="sm" className="justify-start">
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Meeting
            </Button>
            <Button variant="outline" size="sm" className="justify-start">
              <MessageSquare className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Thread Dialog */}
      <EmailThreadDialog
        emailThread={selectedEmailThread}
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        leadName="Sample Lead"
      />
    </div>
  );
}