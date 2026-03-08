import { createDefaultUiShellComposition, bootstrapUiClient } from "./ui-client.js";
import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";

const container = document.getElementById("app");

if (!(container instanceof HTMLElement)) {
  throw new Error("Missing required #app container.");
}

const composition = createDefaultUiShellComposition({
  controller: {
    submit: async (request) => {
      const response = await fetch("/phase2/query-intake", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json"
        },
        body: JSON.stringify(request)
      });

      const payload = (await response.json()) as QueryIntakeResponse | { message?: string };

      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : `Query intake failed (${response.status})`;
        throw new Error(message);
      }

      return payload as QueryIntakeResponse;
    }
  }
});

bootstrapUiClient({
  container,
  composition
});
