import { PWA_SERVICE_WORKER_PATH } from "./pwa-constants.js";

type ServiceWorkerRegistrationTarget = {
  register: (scriptURL: string, options?: RegistrationOptions) => Promise<ServiceWorkerRegistration>;
};

type NavigatorWithOptionalServiceWorker = {
  serviceWorker?: ServiceWorkerRegistrationTarget | null;
};

export type RegisterServiceWorkerOptions = {
  navigatorRef?: NavigatorWithOptionalServiceWorker | null;
  scriptUrl?: string;
  scope?: string;
  onError?: (error: unknown) => void;
};

export async function registerServiceWorker(
  options: RegisterServiceWorkerOptions = {}
): Promise<ServiceWorkerRegistration | null> {
  const navigatorRef = options.navigatorRef ?? readGlobalNavigator();
  const serviceWorker = navigatorRef?.serviceWorker;

  if (!serviceWorker || typeof serviceWorker.register !== "function") {
    return null;
  }

  try {
    return await serviceWorker.register(options.scriptUrl ?? PWA_SERVICE_WORKER_PATH, {
      scope: options.scope ?? "/"
    });
  } catch (error) {
    options.onError?.(error);
    return null;
  }
}

function readGlobalNavigator(): NavigatorWithOptionalServiceWorker | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  return navigator;
}
