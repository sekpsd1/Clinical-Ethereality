import { getAppEnv } from "@/lib/env/schema";

export type SlipVerificationProvider = "slipok" | "easyslip";

export type SlipVerificationInput = {
  qrPayload?: string;
  imageUrl?: string;
  amount?: number;
};

export type SlipVerificationResult = {
  ok: boolean;
  provider: SlipVerificationProvider;
  status: "verified" | "rejected" | "provider_error";
  transRef: string | null;
  amount: number | null;
  receiverName: string | null;
  raw: unknown;
};

function assertConfigured(value: string | undefined, name: string): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new Error(`${name} is required for slip verification.`);
  }

  return normalizedValue;
}

function getProvider(): SlipVerificationProvider {
  const provider = getAppEnv().SLIP_VERIFICATION_PROVIDER;

  if (!provider) {
    throw new Error("SLIP_VERIFICATION_PROVIDER must be slipok or easyslip.");
  }

  return provider;
}

function getDefaultApiUrl(provider: SlipVerificationProvider): string {
  return provider === "easyslip" ? "https://api.easyslip.com/v2" : "https://api.slipok.com";
}

function getInputPayload(input: SlipVerificationInput): { payload?: string; url?: string } {
  if (input.qrPayload) {
    return {
      payload: input.qrPayload
    };
  }

  if (input.imageUrl) {
    return {
      url: input.imageUrl
    };
  }

  throw new Error("Either qrPayload or imageUrl is required for slip verification.");
}

function normalizeReceiverName(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("th-TH");
}

function isReceiverMatch(receiverName: string | null, expectedReceiver: string): boolean {
  if (!receiverName?.trim()) {
    return false;
  }

  return normalizeReceiverName(receiverName) === normalizeReceiverName(expectedReceiver);
}

function isAmountMatch(actualAmount: number | null, expectedAmount: number | undefined): boolean {
  if (
    typeof actualAmount !== "number" ||
    !Number.isFinite(actualAmount) ||
    typeof expectedAmount !== "number" ||
    !Number.isFinite(expectedAmount) ||
    expectedAmount <= 0
  ) {
    return false;
  }

  return Math.round(actualAmount * 100) === Math.round(expectedAmount * 100);
}

export async function verifyPaymentSlip(input: SlipVerificationInput): Promise<SlipVerificationResult> {
  const provider = getProvider();

  if (provider === "easyslip") {
    return verifyWithEasySlip(input);
  }

  return verifyWithSlipOk(input);
}

async function verifyWithEasySlip(input: SlipVerificationInput): Promise<SlipVerificationResult> {
  const env = getAppEnv();
  const apiKey = assertConfigured(env.SLIP_VERIFICATION_API_KEY, "SLIP_VERIFICATION_API_KEY");
  const expectedReceiver = assertConfigured(
    env.SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME,
    "SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME"
  );
  const apiUrl = env.SLIP_VERIFICATION_API_URL ?? getDefaultApiUrl("easyslip");
  const payload = getInputPayload(input);
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/verify/bank`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const raw = (await response.json().catch(() => null)) as EasySlipResponse | null;
  const data = raw?.data ?? null;
  const receiverName = data?.receiver?.account?.name?.th ?? data?.receiver?.account?.name?.en ?? null;
  const amount = typeof data?.amount?.amount === "number" ? data.amount.amount : null;
  const providerAccepted = Boolean(response.ok && raw?.success);
  const hasRequiredVerificationData = Boolean(data?.transRef && amount !== null && receiverName?.trim());
  const verified = Boolean(
    providerAccepted &&
      hasRequiredVerificationData &&
      isAmountMatch(amount, input.amount) &&
      isReceiverMatch(receiverName, expectedReceiver)
  );

  return {
    ok: verified,
    provider: "easyslip",
    status:
      verified
        ? "verified"
        : !response.ok || (providerAccepted && !hasRequiredVerificationData)
          ? "provider_error"
          : "rejected",
    transRef: data?.transRef ?? null,
    amount: typeof amount === "number" ? amount : null,
    receiverName,
    raw
  };
}

async function verifyWithSlipOk(input: SlipVerificationInput): Promise<SlipVerificationResult> {
  const env = getAppEnv();
  const apiKey = assertConfigured(env.SLIP_VERIFICATION_API_KEY, "SLIP_VERIFICATION_API_KEY");
  const branchId = assertConfigured(env.SLIPOK_BRANCH_ID, "SLIPOK_BRANCH_ID");
  const expectedReceiver = assertConfigured(
    env.SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME,
    "SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME"
  );
  const apiUrl = env.SLIP_VERIFICATION_API_URL ?? getDefaultApiUrl("slipok");
  const payload = getInputPayload(input);
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/api/line/apikey/${branchId}`, {
    method: "POST",
    headers: {
      "x-authorization": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      data: payload.payload,
      url: payload.url,
      amount: input.amount,
      log: true
    })
  });
  const raw = (await response.json().catch(() => null)) as SlipOkResponse | null;
  const data = raw?.data ?? null;
  const receiverName = data?.receiver?.displayName ?? data?.receiver?.name ?? null;
  const amount = typeof data?.amount === "number" ? data.amount : null;
  const providerAccepted = Boolean(response.ok && raw?.success && data?.success);
  const hasRequiredVerificationData = Boolean(data?.transRef && amount !== null && receiverName?.trim());
  const verified = Boolean(
    providerAccepted &&
      hasRequiredVerificationData &&
      isAmountMatch(amount, input.amount) &&
      isReceiverMatch(receiverName, expectedReceiver)
  );

  return {
    ok: verified,
    provider: "slipok",
    status:
      verified
        ? "verified"
        : !response.ok || (providerAccepted && !hasRequiredVerificationData)
          ? "provider_error"
          : "rejected",
    transRef: data?.transRef ?? null,
    amount,
    receiverName,
    raw
  };
}

type EasySlipResponse = {
  success?: boolean;
  data?: {
    transRef?: string;
    amount?: {
      amount?: number;
    };
    receiver?: {
      account?: {
        name?: {
          th?: string;
          en?: string;
        };
      };
    };
  };
};

type SlipOkResponse = {
  success?: boolean;
  data?: {
    success?: boolean;
    transRef?: string;
    amount?: number;
    receiver?: {
      displayName?: string;
      name?: string;
    };
  };
};
