// TypeScript Types for MDC Frontend
// Generated from backend DTOs and Prisma schema
// Last updated: 2026-05-25

// ============================================================================
// ENUMS
// ============================================================================

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
  DELETED = 'DELETED',
  SUSPENDED = 'SUSPENDED',
}

export enum ProfileVisibility {
  PUBLIC = 'PUBLIC',
  CONNECTIONS_ONLY = 'CONNECTIONS_ONLY',
  PRIVATE = 'PRIVATE',
}

export enum SkillCategory {
  LANGUAGE = 'LANGUAGE',
  FRAMEWORK = 'FRAMEWORK',
  TOOL = 'TOOL',
  SOFT = 'SOFT',
  OTHER = 'OTHER',
}

export enum SkillProficiency {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT',
}

export enum LanguageProficiency {
  ELEMENTARY = 'ELEMENTARY',
  LIMITED_WORKING = 'LIMITED_WORKING',
  PROFESSIONAL_WORKING = 'PROFESSIONAL_WORKING',
  FULL_PROFESSIONAL = 'FULL_PROFESSIONAL',
  NATIVE_BILINGUAL = 'NATIVE_BILINGUAL',
}

export enum Industry {
  TECHNOLOGY = 'TECHNOLOGY',
  FINANCE = 'FINANCE',
  HEALTHCARE = 'HEALTHCARE',
  EDUCATION = 'EDUCATION',
  RETAIL = 'RETAIL',
  MANUFACTURING = 'MANUFACTURING',
  CONSULTING = 'CONSULTING',
  REAL_ESTATE = 'REAL_ESTATE',
  HOSPITALITY = 'HOSPITALITY',
  TRANSPORTATION = 'TRANSPORTATION',
  ENERGY = 'ENERGY',
  TELECOMMUNICATIONS = 'TELECOMMUNICATIONS',
  MEDIA = 'MEDIA',
  LEGAL = 'LEGAL',
  NONPROFIT = 'NONPROFIT',
  GOVERNMENT = 'GOVERNMENT',
  AGRICULTURE = 'AGRICULTURE',
  CONSTRUCTION = 'CONSTRUCTION',
  AUTOMOTIVE = 'AUTOMOTIVE',
  OTHER = 'OTHER',
}

export enum CompanyRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  BILLING_ADMIN = 'BILLING_ADMIN',
}

export enum ApplyMode {
  INTERNAL = 'INTERNAL',
  EXTERNAL = 'EXTERNAL',
  HYBRID = 'HYBRID',
}

export enum EmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERNSHIP = 'INTERNSHIP',
  TEMPORARY = 'TEMPORARY',
}

export enum JobStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CLOSED = 'CLOSED',
  DELETED = 'DELETED',
}

export enum WorkplaceType {
  ONSITE = 'ONSITE',
  HYBRID = 'HYBRID',
  REMOTE = 'REMOTE',
}

export enum ApplicationStatus {
  SUBMITTED = 'SUBMITTED',
  REVIEWED = 'REVIEWED',
  INTERVIEWING = 'INTERVIEWING',
  OFFER = 'OFFER',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum ConnectionStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  REMOVED = 'REMOVED',
}

export enum FollowStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum NotificationType {
  ApplicationSubmitted = 'ApplicationSubmitted',
  ApplicationStatusChanged = 'ApplicationStatusChanged',
  ApplicationNoteAdded = 'ApplicationNoteAdded',
  ApplicationWithdrawn = 'ApplicationWithdrawn',
  JobPublished = 'JobPublished',
  JobUpdated = 'JobUpdated',
  JobClosed = 'JobClosed',
  CandidateSaved = 'CandidateSaved',
  CandidateAddedToTalentPool = 'CandidateAddedToTalentPool',
  RecruiterSeatAllocated = 'RecruiterSeatAllocated',
  ConnectionRequested = 'ConnectionRequested',
  ConnectionAccepted = 'ConnectionAccepted',
  UserBlocked = 'UserBlocked',
  System = 'System',
  PostLiked = 'PostLiked',
  PostCommented = 'PostCommented',
  MentionedInPost = 'MentionedInPost',
  MentionedInComment = 'MentionedInComment',
  NewMessage = 'NewMessage',
}

export enum ConversationType {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
}

export enum ParticipantRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum MessageType {
  TEXT = 'TEXT',
  SYSTEM = 'SYSTEM',
}

export enum ReportEntityType {
  POST = 'POST',
  COMMENT = 'COMMENT',
  MESSAGE = 'MESSAGE',
  PROFILE = 'PROFILE',
  COMPANY = 'COMPANY',
  JOB = 'JOB',
}

export enum ReportCategory {
  SPAM = 'SPAM',
  HARASSMENT = 'HARASSMENT',
  HATE_SPEECH = 'HATE_SPEECH',
  MISINFORMATION = 'MISINFORMATION',
  VIOLENCE = 'VIOLENCE',
  IMPERSONATION = 'IMPERSONATION',
  COPYRIGHT = 'COPYRIGHT',
  INAPPROPRIATE = 'INAPPROPRIATE',
  OTHER = 'OTHER',
}

export enum ReportStatus {
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED_ACTIONED = 'RESOLVED_ACTIONED',
  RESOLVED_DISMISSED = 'RESOLVED_DISMISSED',
}

export enum ModerationActionType {
  WARN = 'WARN',
  REMOVE_CONTENT = 'REMOVE_CONTENT',
  SUSPEND_USER = 'SUSPEND_USER',
  BAN_USER = 'BAN_USER',
  DISMISS = 'DISMISS',
}

export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
}

export enum AdminPermissionName {
  MANAGE_USERS = 'MANAGE_USERS',
  MANAGE_COMPANIES = 'MANAGE_COMPANIES',
  MANAGE_JOBS = 'MANAGE_JOBS',
  MODERATE_CONTENT = 'MODERATE_CONTENT',
  VIEW_ANALYTICS = 'VIEW_ANALYTICS',
  MANAGE_ADMINS = 'MANAGE_ADMINS',
}

export enum PostStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
  FLAGGED = 'FLAGGED',
  HIDDEN = 'HIDDEN',
  REMOVED_BY_MODERATOR = 'REMOVED_BY_MODERATOR',
}

export enum PostVisibility {
  PUBLIC = 'PUBLIC',
  CONNECTIONS = 'CONNECTIONS',
  PRIVATE = 'PRIVATE',
}

export enum ReactionType {
  LIKE = 'LIKE',
  CELEBRATE = 'CELEBRATE',
  SUPPORT = 'SUPPORT',
  LOVE = 'LOVE',
  INSIGHTFUL = 'INSIGHTFUL',
  CURIOUS = 'CURIOUS',
}

export enum MediaStatus {
  PENDING = 'PENDING',
  READY = 'READY',
  QUARANTINED = 'QUARANTINED',
  DELETED = 'DELETED',
}

export enum MediaVisibility {
  PRIVATE = 'PRIVATE',
  CONNECTIONS_ONLY = 'CONNECTIONS_ONLY',
  PUBLIC = 'PUBLIC',
}

// ============================================================================
// CORE ENTITIES
// ============================================================================

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  status: UserStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  id: string;
  userId: string;
  headline: string | null;
  about: string | null;
  location: string | null;
  website: string | null;
  openToWork: boolean;
  recruitingEligible: boolean;
  visibility: ProfileVisibility;
  skills: ProfileSkill[];
  experiences: Experience[];
  educations: Education[];
  certifications: Certification[];
  languages: ProfileLanguage[];
  createdAt: string;
  updatedAt: string;
}

export interface ProfileSkill {
  id: string;
  profileId: string;
  skillId: string;
  name: string;
  category: SkillCategory | null;
  proficiency: SkillProficiency | null;
  endorsementCount?: number;
  createdAt: string;
}

export interface Experience {
  id: string;
  profileId: string;
  title: string;
  company: string;
  companyUrl: string | null;
  location: string | null;
  description: string | null;
  startDate: string; // ISO date
  endDate: string | null; // ISO date
  isCurrent: boolean;
  createdAt: string;
}

export interface Education {
  id: string;
  profileId: string;
  school: string;
  degree: string;
  fieldOfStudy: string | null;
  startDate: string; // ISO date
  endDate: string | null; // ISO date
  grade: string | null;
  activities: string | null;
  createdAt: string;
}

export interface Certification {
  id: string;
  profileId: string;
  name: string;
  issuingOrganization: string;
  issueDate: string; // ISO date
  expirationDate: string | null; // ISO date
  credentialId: string | null;
  credentialUrl: string | null;
  createdAt: string;
}

export interface ProfileLanguage {
  id: string;
  profileId: string;
  language: string;
  proficiency: LanguageProficiency;
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  industry: Industry | null;
  description: string | null;
  website: string | null;
  logoMediaAssetId: string | null;
  coverMediaAssetId: string | null;
  verified: boolean;
  verifiedAt: string | null;
  employeeCount: string | null;
  foundedYear: number | null;
  headquarters: string | null;
  followerCount?: number;
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyMember {
  id: string;
  companyId: string;
  userId: string;
  role: CompanyRole;
  title: string | null;
  status: string;
  joinedAt: string;
  user?: User;
}

export interface Job {
  id: string;
  companyId: string;
  title: string;
  description: string;
  applyMode: ApplyMode;
  applyUrl: string | null;
  employmentType: EmploymentType;
  workplaceType: WorkplaceType;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  status: JobStatus;
  publishedAt: string | null;
  closedAt: string | null;
  skills: string[];
  company?: Company;
  viewCount?: number;
  applicationCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface JobSkill {
  id: string;
  jobId: string;
  skillId: string;
  name: string;
  required: boolean;
}

export interface Application {
  id: string;
  jobId: string;
  userId: string;
  status: ApplicationStatus;
  resumeMediaAssetId: string | null;
  coverLetter: string | null;
  submittedAt: string;
  updatedAt: string;
  withdrawnAt: string | null;
  job?: Job;
  user?: User;
  statusEvents?: ApplicationStatusEvent[];
  notes?: ApplicationNote[];
}

export interface ApplicationStatusEvent {
  id: string;
  applicationId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  changedByUserId: string;
  createdAt: string;
}

export interface ApplicationNote {
  id: string;
  applicationId: string;
  authorUserId: string;
  content: string;
  createdAt: string;
  author?: User;
}

export interface Post {
  id: string;
  authorId: string;
  content: string;
  status: PostStatus;
  visibility: PostVisibility;
  reactionCount: number;
  commentCount: number;
  author?: User;
  reactions?: Reaction[];
  media?: PostMedia[];
  hashtags?: string[];
  mentions?: Mention[];
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  reactionCount: number;
  author?: User;
  reactions?: Reaction[];
  createdAt: string;
  updatedAt: string;
}

export interface Reaction {
  id: string;
  postId: string | null;
  commentId: string | null;
  authorId: string;
  type: ReactionType;
  author?: User;
  createdAt: string;
}

export interface PostMedia {
  id: string;
  postId: string;
  mediaAssetId: string;
  displayOrder: number;
  mediaAsset?: MediaAsset;
}

export interface Mention {
  id: string;
  postId: string | null;
  commentId: string | null;
  mentionerId: string;
  mentionedUserId: string;
  createdAt: string;
}

export interface Connection {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: ConnectionStatus;
  requester?: User;
  addressee?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  participants: ConversationParticipant[];
  lastMessage?: Message;
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  role: ParticipantRole;
  lastReadAt: string | null;
  joinedAt: string;
  user?: User;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  content: string;
  sender?: User;
  attachments?: MessageAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface MessageAttachment {
  id: string;
  messageId: string;
  mediaAssetId: string;
  displayOrder: number;
  mediaAsset?: MediaAsset;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string | null;
  body: string | null;
  actionUrl: string | null;
  readAt: string | null;
  payload: Record<string, any> | null;
  createdAt: string;
}

export interface MediaAsset {
  id: string;
  ownerId: string;
  purpose: string;
  filename: string;
  s3Key: string;
  s3Bucket: string;
  contentType: string;
  sizeBytes: number | null;
  status: MediaStatus;
  visibility: MediaVisibility;
  downloadUrl?: string; // Presigned URL
  createdAt: string;
  updatedAt: string;
}

export interface SavedCandidate {
  id: string;
  companyId: string;
  candidateUserId: string;
  savedByUserId: string;
  sourceId: string | null;
  candidate?: User;
  savedBy?: User;
  notes?: CandidateNote[];
  createdAt: string;
}

export interface TalentPool {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  createdByUserId: string;
  candidateCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateNote {
  id: string;
  companyId: string;
  candidateUserId: string;
  authorUserId: string;
  content: string;
  author?: User;
  createdAt: string;
}

export interface Report {
  id: string;
  reporterId: string;
  targetEntity: ReportEntityType;
  targetId: string;
  category: ReportCategory;
  description: string | null;
  status: ReportStatus;
  priority: number;
  assignedToId: string | null;
  resolvedAt: string | null;
  reporter?: User;
  assignedTo?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  companyId: string;
  planId: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  plan?: BillingPlan;
  createdAt: string;
  updatedAt: string;
}

export interface BillingPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  features: Record<string, any>;
  priceMonthly: number;
  priceYearly: number | null;
  currency: string;
  isPublic: boolean;
  isActive: boolean;
}

export interface Invoice {
  id: string;
  subscriptionId: string;
  companyId: string;
  invoiceNumber: string | null;
  status: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string | null;
  paidAt: string | null;
  providerInvoiceUrl: string | null;
  lineItems?: InvoiceLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

// Auth
export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface RequestPasswordResetRequest {
  email: string;
}

export interface ConfirmPasswordResetRequest {
  token: string;
  newPassword: string;
}

// Profile
export interface CreateProfileRequest {
  headline?: string;
  about?: string;
  location?: string;
  website?: string;
  openToWork?: boolean;
  recruitingEligible?: boolean;
  visibility?: ProfileVisibility;
  skills?: SkillInput[];
  experiences?: ExperienceInput[];
  educations?: EducationInput[];
  certifications?: CertificationInput[];
  languages?: LanguageInput[];
}

export interface UpdateProfileRequest extends Partial<CreateProfileRequest> {}

export interface SkillInput {
  name: string;
  category?: SkillCategory;
  proficiency?: SkillProficiency;
}

export interface ExperienceInput {
  title: string;
  company: string;
  companyUrl?: string;
  location?: string;
  description?: string;
  startDate: string; // ISO date
  endDate?: string; // ISO date
  isCurrent?: boolean;
}

export interface EducationInput {
  school: string;
  degree: string;
  fieldOfStudy?: string;
  startDate: string;
  endDate?: string;
  grade?: string;
  activities?: string;
}

export interface CertificationInput {
  name: string;
  issuingOrganization: string;
  issueDate: string;
  expirationDate?: string;
  credentialId?: string;
  credentialUrl?: string;
}

export interface LanguageInput {
  language: string;
  proficiency: LanguageProficiency;
}

// Company
export interface CreateCompanyRequest {
  name: string;
  industry?: Industry;
  description?: string;
  website?: string;
  employeeCount?: string;
  foundedYear?: number;
  headquarters?: string;
}

export interface UpdateCompanyRequest extends Partial<CreateCompanyRequest> {
  logoMediaAssetId?: string;
  coverMediaAssetId?: string;
}

export interface InviteMemberRequest {
  email: string;
  role: CompanyRole;
}

export interface UpdateMemberRoleRequest {
  role: CompanyRole;
}

export interface AcceptInvitationRequest {
  token: string;
}

export interface AllocateRecruiterSeatRequest {
  userId: string;
}

// Job
export interface CreateJobRequest {
  title: string;
  description: string;
  companyId: string;
  applyMode: ApplyMode;
  applyUrl?: string;
  employmentType: EmploymentType;
  workplaceType: WorkplaceType;
  location?: string;
  skillIds?: string[];
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
}

export interface UpdateJobRequest extends Partial<
  Omit<CreateJobRequest, 'companyId'>
> {}

export interface JobSkillInput {
  skillId: string;
}

export interface ListJobsQuery {
  companyId?: string;
  status?: JobStatus;
  employmentType?: EmploymentType;
  workplaceType?: WorkplaceType;
  location?: string;
  skillId?: string;
  q?: string;
}

// Application
export interface ScreeningAnswerInput {
  questionId: string;
  question: string;
  answer: string;
}

export interface SubmitApplicationRequest {
  coverLetter?: string;
  screeningAnswers?: ScreeningAnswerInput[];
  resumeMediaAssetId?: string;
}

export interface UpdateApplicationStatusRequest {
  newStatus: ApplicationStatus;
  reason?: string;
}

export interface CreateApplicationNoteRequest {
  content: string;
}

// Post
export interface CreatePostRequest {
  content: string;
  visibility?: PostVisibility;
  mediaAssetIds?: string[];
}

export interface UpdatePostRequest {
  content?: string;
  visibility?: PostVisibility;
}

export interface CreateCommentRequest {
  content: string;
  parentId?: string;
}

export interface UpdateCommentRequest {
  content: string;
}

export interface CreateReactionRequest {
  type: ReactionType;
}

// Connection
export interface SendConnectionRequestRequest {
  toUserId: string;
}

// Messaging
export interface CreateConversationRequest {
  participantIds: string[];
}

export interface CreateRecruitingConversationRequest {
  candidateUserId: string;
}

export interface SendMessageRequest {
  content: string;
}

// Notification
export interface UpdateNotificationPreferenceRequest {
  newMessage?: boolean;
  connectionRequest?: boolean;
  connectionAccepted?: boolean;
  applicationStatusChange?: boolean;
  jobRecommendation?: boolean;
  postInteraction?: boolean;
}

// Search
export interface SearchQuery {
  q: string;
  type?: Array<'users' | 'companies' | 'jobs' | 'posts'>;
  limit?: number;
}

// Recruiting
export interface SaveCandidateRequest {
  candidateUserId: string;
  sourceId?: string;
  note?: string;
}

export interface CreateTalentPoolRequest {
  name: string;
  description?: string;
}

export interface UpdateTalentPoolRequest {
  name?: string;
  description?: string;
}

export interface AddCandidateToPoolRequest {
  candidateUserId: string;
}

export interface CreateCandidateNoteRequest {
  content: string;
}

// Media
export interface InitiateUploadRequest {
  purpose: 'avatar' | 'resume' | 'attachment';
  filename: string;
  contentType: string;
  sizeBytes: number;
}

export interface InitiateUploadResponse {
  mediaId: string;
  uploadUrl: string;
  expiresIn: number;
}

export interface ConfirmUploadRequest {}

// Moderation
export interface CreateReportRequest {
  targetEntity: ReportEntityType;
  targetId: string;
  category: ReportCategory;
  description?: string;
}

export interface CreateModerationActionRequest {
  reportId: string;
  actionType: ModerationActionType;
  targetEntity: ReportEntityType;
  targetId: string;
  reason: string;
  durationHours?: number;
}

// Billing
export interface CreateSubscriptionRequest {
  planId: string;
}

// ============================================================================
// API RESPONSE WRAPPERS
// ============================================================================

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    requestId?: string;
  };
}

// ============================================================================
// WEBSOCKET EVENT TYPES
// ============================================================================

export interface MessageNewEvent {
  conversationId: string;
  message: Message;
}

export interface NotificationNewEvent {
  notification: Notification;
}

export interface TypingEvent {
  conversationId: string;
  userId: string;
}

export interface MessageReadEvent {
  messageId: string;
}

export interface ConversationJoinEvent {
  conversationId: string;
}
