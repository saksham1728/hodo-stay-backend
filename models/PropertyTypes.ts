// TypeScript Type Definitions for Property Content Data Model
// This file serves as documentation and can be used for frontend TypeScript projects

export interface Property {
  id: string;
  slug: string;
  title: string;
  subTitle?: string;
  description: string;
  location: PropertyLocation;
  heroImage: string;
  gallery: PropertyImage[];
  highlights?: string[];
  amenities: Amenity[];
  accessibility: AccessibilitySection[];
  policies: PropertyPolicies[];
  reviewSummary: ReviewSummary[];
  reviews?: Review[];
  roomTypes: RoomType[];
  seo: PropertySEO;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyLocation {
  addressLine1: string;
  addressLine2?: string;
  area?: string;
  city: string;
  state: string;
  country: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
}

export interface PropertyImage {
  id: string;
  url: string;
  altText?: string;
  type?: "bedroom" | "living" | "kitchen" | "bathroom" | "exterior" | "common" | "other";
  order?: number;
}

export interface Amenity {
  id: string;
  name: string;
  icon?: string;
  category?: "general" | "kitchen" | "bathroom" | "safety" | "parking" | "entertainment";
}

export interface AccessibilitySection {
  walkScore?: string;
  nearbyTransit?: NearbyItem[];
  nearbyPlaces?: NearbyItem[];
  neighbourhoodHighlights?: string[];
}

export interface NearbyItem {
  name: string;
  distance?: string;
  travelTime?: string;
  type?: "metro" | "bus" | "airport" | "restaurant" | "hospital" | "techpark" | "landmark";
}

export interface PropertyPolicies {
  checkIn: CheckInPolicy[];
  checkOut: CheckOutPolicy[];
  housekeeping: HousekeepingPolicy[];
  longStay?: LongStayPolicy[];
  cancellation: CancellationPolicy[];
  payments: PaymentPolicy;
  otherRules?: string[];
}

export interface CheckInPolicy {
  time: string;
  earlyCheckInAllowed?: boolean;
  earlyCheckInNote?: string;
}

export interface CheckOutPolicy {
  time: string;
  lateCheckOutAllowed?: boolean;
  lateCheckOutNote?: string;
}

export interface HousekeepingPolicy {
  frequency: "daily" | "alternate_day" | "weekly" | "on_request";
  linenChange?: string;
  towelChange?: string;
  additionalCleaningCharge?: number;
}

export interface LongStayPolicy {
  minimumNights?: number;
  monthlyDiscountPercentage?: number;
  customPricingAvailable?: boolean;
  notes?: string;
}

export interface CancellationPolicy {
  policyType: "flexible" | "moderate" | "strict" | "non_refundable";
  freeCancellationBeforeHours?: number;
  partialRefundBeforeHours?: number;
  notes?: string;
}

export interface PaymentPolicy {
  acceptedMethods: PaymentMethod[];
  securityDepositRequired?: boolean;
  securityDepositAmount?: number;
  securityDepositRefundPolicy?: string;
}

export type PaymentMethod =
  | "credit_card"
  | "debit_card"
  | "upi"
  | "net_banking"
  | "wallet"
  | "bank_transfer"
  | "cash";

export interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  ratingBreakdown?: RatingBreakdown;
}

export interface RatingBreakdown {
  fiveStar: number;
  fourStar: number;
  threeStar: number;
  twoStar: number;
  oneStar: number;
}

export interface Review {
  id: string;
  userName: string;
  rating: number;
  title?: string;
  comment: string;
  date: string;
  avatarUrl?: string;
  isVerified?: boolean;
}

export interface PropertySEO {
  metaTitle: string;
  metaDescription: string;
  keywords?: string[];
  ogImage?: string;
  canonicalUrl?: string;
}

export interface RoomType {
  id: string;
  name: string;
  description?: string;
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  sizeSqft?: number;
  defaultPrice?: number;
  mappedRentalIds: string[];
}
