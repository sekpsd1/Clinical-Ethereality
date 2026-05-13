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
  if (!value) {
    throw new Error(`${name} is required for slip verification.`);
  }

  return value;
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

function isReceiverMatch(receiverName: string | null): boolean {
  const expectedReceiver = getAppEnv().SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME;

  if (!expectedReceiver || !receiverName) {
    return true;
  }

  return receiverName.toLowerCase().includes(expectedReceiver.toLowerCase());
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
  const amount = data?.amount?.amount ?? null;
  const isAmountMatch = typeof input.amount !== "number" || Number(amount) === input.amount;
  const verified = Boolean(response.ok && raw?.success && data?.transRef && isAmountMatch && isReceiverMatch(receiverName));

  return {
    ok: verified,
    provider: "easyslip",
    status: verified ? "verified" : response.ok ? "rejected" : "provider_error",
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
  const verified = Boolean(response.ok && raw?.success && data?.success && data?.transRef && isReceiverMatch(receiverName));

  return {
    ok: verified,
    provider: "slipok",
    status: verified ? "verified" : response.ok ? "rejected" : "provider_error",
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
