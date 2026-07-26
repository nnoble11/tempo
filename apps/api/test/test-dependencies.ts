import type {
  BriefingInteraction,
  BriefingHistoryPage,
  BriefingItemState,
  CalendarAvailability,
  CalendarConnection,
  CanonicalBriefing,
  CompleteOnboardingResult,
  Delivery,
  DeliveryEndpoint,
  InterestPage,
  LibraryItemPage,
  UserInterest,
  UserPreferences,
  UserProfile,
} from "@tempo/contracts";
import type {
  AccountRepository,
  BriefingRepository,
  CalendarRepository,
  LibraryRepository,
} from "@tempo/database";
import type {
  DeliveryConfiguration,
  DeliveryRepository,
} from "@tempo/database";

import type { AppDependencies } from "../src/app.js";

class UnavailableAccountRepository implements AccountRepository {
  public ensureUser(): Promise<UserProfile> {
    return Promise.reject(new Error("Account repository is unavailable."));
  }

  public getPreferences(): Promise<UserPreferences | null> {
    return Promise.reject(new Error("Account repository is unavailable."));
  }

  public updatePreferences(): Promise<UserPreferences> {
    return Promise.reject(new Error("Account repository is unavailable."));
  }

  public createInterest(): Promise<UserInterest> {
    return Promise.reject(new Error("Account repository is unavailable."));
  }

  public listInterests(): Promise<InterestPage> {
    return Promise.reject(new Error("Account repository is unavailable."));
  }

  public updateInterest(): Promise<UserInterest | null> {
    return Promise.reject(new Error("Account repository is unavailable."));
  }

  public deleteInterest(): Promise<boolean> {
    return Promise.reject(new Error("Account repository is unavailable."));
  }

  public completeOnboarding(): Promise<CompleteOnboardingResult> {
    return Promise.reject(new Error("Account repository is unavailable."));
  }
}

class UnavailableBriefingRepository implements BriefingRepository {
  public saveCanonicalBriefing(): Promise<CanonicalBriefing> {
    return Promise.reject(new Error("Briefing repository is unavailable."));
  }

  public getBriefing(): Promise<CanonicalBriefing | null> {
    return Promise.reject(new Error("Briefing repository is unavailable."));
  }

  public getLatestBriefing(): Promise<CanonicalBriefing | null> {
    return Promise.reject(new Error("Briefing repository is unavailable."));
  }

  public getBriefingByGenerationKey(): Promise<CanonicalBriefing | null> {
    return Promise.reject(new Error("Briefing repository is unavailable."));
  }

  public listBriefings(): Promise<BriefingHistoryPage> {
    return Promise.reject(new Error("Briefing repository is unavailable."));
  }

  public recordInteraction(): Promise<BriefingInteraction | null> {
    return Promise.reject(new Error("Briefing repository is unavailable."));
  }
}

class UnavailableLibraryRepository implements LibraryRepository {
  public updateItemState(): Promise<{
    found: false;
    state: null;
  }> {
    return Promise.reject(new Error("Library repository is unavailable."));
  }

  public listBriefingItemStates(): Promise<BriefingItemState[]> {
    return Promise.reject(new Error("Library repository is unavailable."));
  }

  public listItems(): Promise<LibraryItemPage> {
    return Promise.reject(new Error("Library repository is unavailable."));
  }
}

class UnavailableCalendarRepository implements CalendarRepository {
  public connectDeviceCalendar(): Promise<CalendarConnection> {
    return Promise.reject(new Error("Calendar repository is unavailable."));
  }

  public syncAvailability(): Promise<CalendarConnection | null> {
    return Promise.reject(new Error("Calendar repository is unavailable."));
  }

  public getAvailability(): Promise<CalendarAvailability> {
    return Promise.reject(new Error("Calendar repository is unavailable."));
  }

  public disconnect(): Promise<boolean> {
    return Promise.reject(new Error("Calendar repository is unavailable."));
  }
}

class UnavailableDeliveryRepository implements DeliveryRepository {
  public upsertEndpoint(): Promise<DeliveryEndpoint> {
    return Promise.reject(new Error("Delivery repository is unavailable."));
  }

  public requestEndpointVerification(): Promise<DeliveryEndpoint | null> {
    return Promise.reject(new Error("Delivery repository is unavailable."));
  }

  public verifyEndpoint(): Promise<never> {
    return Promise.reject(new Error("Delivery repository is unavailable."));
  }

  public listEndpoints(): Promise<DeliveryEndpoint[]> {
    return Promise.reject(new Error("Delivery repository is unavailable."));
  }

  public disableEndpoint(): Promise<boolean> {
    return Promise.reject(new Error("Delivery repository is unavailable."));
  }

  public getConfiguration(): Promise<DeliveryConfiguration> {
    return Promise.reject(new Error("Delivery repository is unavailable."));
  }

  public saveDelivery(): Promise<Delivery> {
    return Promise.reject(new Error("Delivery repository is unavailable."));
  }

  public listDeliveries(): Promise<Delivery[]> {
    return Promise.reject(new Error("Delivery repository is unavailable."));
  }

  public claimDueDeliveries(): Promise<Delivery[]> {
    return Promise.reject(new Error("Delivery repository is unavailable."));
  }

  public markDeliverySent(): Promise<void> {
    return Promise.reject(new Error("Delivery repository is unavailable."));
  }

  public markDeliveryFailed(): Promise<void> {
    return Promise.reject(new Error("Delivery repository is unavailable."));
  }

  public claimPushReceipts(): Promise<never[]> {
    return Promise.reject(new Error("Delivery repository is unavailable."));
  }

  public markPushReceiptAccepted(): Promise<void> {
    return Promise.reject(new Error("Delivery repository is unavailable."));
  }

  public markPushReceiptFailed(): Promise<void> {
    return Promise.reject(new Error("Delivery repository is unavailable."));
  }
}

export const createUnusedDependencies = (): AppDependencies => ({
  accountRepository: new UnavailableAccountRepository(),
  briefingRepository: new UnavailableBriefingRepository(),
  calendarRepository: new UnavailableCalendarRepository(),
  deliveryRepository: new UnavailableDeliveryRepository(),
  libraryRepository: new UnavailableLibraryRepository(),
  deliveryVerificationSecret: "test-verification-secret-at-least-32-characters",
  verificationSender: {
    sendCode: () =>
      Promise.reject(new Error("Verification sender is unavailable.")),
  },
  accessTokenVerifier: {
    verify: () => Promise.reject(new Error("Token verifier is unavailable.")),
  },
});
