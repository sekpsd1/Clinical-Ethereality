const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const CONFIRMATION = "RESET_CONSULT_FLOW";

function getArgument(name) {
  const prefix = `--${name}=`;
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : null;
}

function loadDatabaseUrl() {
  const envFile = getArgument("env-file");

  if (envFile) {
    const absolutePath = path.resolve(process.cwd(), envFile);
    const contents = fs.readFileSync(absolutePath, "utf8");
    const line = contents
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith("DATABASE_URL="));

    if (!line) {
      throw new Error(`ไม่พบ DATABASE_URL ใน ${absolutePath}`);
    }

    const rawValue = line.slice(line.indexOf("=") + 1).trim();
    process.env.DATABASE_URL = rawValue.replace(/^(['"])(.*)\1$/, "$2");
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("ไม่พบ DATABASE_URL");
  }

  return new URL(process.env.DATABASE_URL);
}

async function getCounts(prisma) {
  const [
    assessments,
    consultations,
    consultationMessages,
    slotLocks,
    prescriptions,
    relatedNotifications,
    linkedOrderItems,
    users,
    products,
    orders
  ] = await Promise.all([
    prisma.consultAssessment.count(),
    prisma.consultation.count(),
    prisma.consultationMessage.count(),
    prisma.consultationSlotLock.count(),
    prisma.prescription.count(),
    prisma.notification.count({
      where: {
        type: {
          in: ["consultation", "prescription"]
        }
      }
    }),
    prisma.orderItem.count({
      where: {
        prescriptionId: {
          not: null
        }
      }
    }),
    prisma.user.count(),
    prisma.product.count(),
    prisma.order.count()
  ]);

  return {
    assessments,
    consultations,
    consultationMessages,
    slotLocks,
    prescriptions,
    relatedNotifications,
    linkedOrderItems,
    preserved: {
      users,
      products,
      orders
    }
  };
}

async function main() {
  const databaseUrl = loadDatabaseUrl();
  const expectedDatabase = getArgument("expected-database");
  const expectedHost = getArgument("expected-host");
  const confirmation = getArgument("confirm");
  const database = databaseUrl.pathname.replace(/^\/+/, "");

  if (!expectedDatabase || database !== expectedDatabase) {
    throw new Error(
      `ชื่อฐานข้อมูลไม่ตรง: พบ "${database}" แต่คาดหวัง "${expectedDatabase ?? "(ไม่ได้ระบุ)"}"`
    );
  }

  if (expectedHost && databaseUrl.hostname !== expectedHost) {
    throw new Error(
      `โฮสต์ฐานข้อมูลไม่ตรง: พบ "${databaseUrl.hostname}" แต่คาดหวัง "${expectedHost}"`
    );
  }

  const prisma = new PrismaClient();

  try {
    const before = await getCounts(prisma);
    const target = {
      host: databaseUrl.hostname,
      port: databaseUrl.port || "3306",
      database
    };

    if (confirmation !== CONFIRMATION) {
      console.log(
        JSON.stringify(
          {
            mode: "dry-run",
            target,
            before,
            executeWith: `--confirm=${CONFIRMATION}`
          },
          null,
          2
        )
      );
      return;
    }

    const deleted = await prisma.$transaction(
      async (transaction) => {
        const detachedOrderItems = await transaction.orderItem.updateMany({
          where: {
            prescriptionId: {
              not: null
            }
          },
          data: {
            prescriptionId: null
          }
        });
        const prescriptions = await transaction.prescription.deleteMany();
        const consultations = await transaction.consultation.deleteMany();
        const slotLocks = await transaction.consultationSlotLock.deleteMany();
        const assessments = await transaction.consultAssessment.deleteMany();
        const notifications = await transaction.notification.deleteMany({
          where: {
            type: {
              in: ["consultation", "prescription"]
            }
          }
        });

        await transaction.auditLog.create({
          data: {
            action: "maintenance.reset_consult_flow",
            entityType: "system",
            metadataJson: {
              target,
              before,
              deleted: {
                assessments: assessments.count,
                consultations: consultations.count,
                slotLocks: slotLocks.count,
                prescriptions: prescriptions.count,
                relatedNotifications: notifications.count,
                detachedOrderItems: detachedOrderItems.count
              }
            }
          }
        });

        return {
          assessments: assessments.count,
          consultations: consultations.count,
          slotLocks: slotLocks.count,
          prescriptions: prescriptions.count,
          relatedNotifications: notifications.count,
          detachedOrderItems: detachedOrderItems.count
        };
      },
      {
        maxWait: 10_000,
        timeout: 30_000
      }
    );

    const after = await getCounts(prisma);

    console.log(
      JSON.stringify(
        {
          mode: "executed",
          target,
          before,
          deleted,
          after
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
