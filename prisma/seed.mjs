import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const seedUsers = [
  {
    lineUserId: "seed-line-admin",
    displayName: "ผู้ดูแลระบบทดสอบ",
    email: "admin.local@clinical-ethereality.test",
    role: "admin",
    status: "active"
  },
  {
    lineUserId: "seed-line-customer",
    displayName: "ลูกค้าทดสอบ",
    email: "customer.local@clinical-ethereality.test",
    role: "customer",
    status: "active",
    rewardBalance: 120
  },
  {
    lineUserId: "seed-line-doctor-pending",
    displayName: "พญ. อรยา รอตรวจสอบ",
    email: "doctor.pending@clinical-ethereality.test",
    role: "customer",
    status: "pending_review",
    doctorProfile: {
      licenseNumber: "MD-SEED-001",
      specialty: "ผิวหนังและความงาม",
      bio: "แพทย์ทดสอบสำหรับคิวอนุมัติบุคลากร",
      consultationFee: 700,
      status: "pending_review"
    }
  },
  {
    lineUserId: "seed-line-doctor-approved",
    displayName: "นพ. สมชาย อนุมัติแล้ว",
    email: "doctor.approved@clinical-ethereality.test",
    role: "doctor",
    status: "active",
    doctorProfile: {
      licenseNumber: "MD-SEED-002",
      specialty: "เวชศาสตร์ชะลอวัย",
      bio: "แพทย์ทดสอบที่อนุมัติแล้วสำหรับตรวจสอบสถานะในระบบผู้ดูแล",
      consultationFee: 900,
      status: "approved",
      approvedAt: new Date("2026-05-01T03:00:00.000Z")
    }
  },
  {
    lineUserId: "seed-line-pharmacist-pending",
    displayName: "ภก. กิตติ รอตรวจสอบ",
    email: "pharmacist.pending@clinical-ethereality.test",
    role: "customer",
    status: "pending_review",
    pharmacistProfile: {
      licenseNumber: "PH-SEED-001",
      pharmacyName: "Clinical Ethereality Pharmacy",
      status: "pending_review"
    }
  },
  {
    lineUserId: "seed-line-pharmacist-approved",
    displayName: "ภญ. มินตรา อนุมัติแล้ว",
    email: "pharmacist.approved@clinical-ethereality.test",
    role: "pharmacist",
    status: "active",
    pharmacistProfile: {
      licenseNumber: "PH-SEED-002",
      pharmacyName: "Clinical Ethereality Pharmacy",
      status: "approved",
      approvedAt: new Date("2026-05-02T03:00:00.000Z")
    }
  },
  {
    lineUserId: "seed-line-suspended",
    displayName: "บัญชีระงับทดสอบ",
    email: "suspended.local@clinical-ethereality.test",
    role: "customer",
    status: "suspended"
  }
];

const seedProducts = [
  {
    name: "Paracetamol 500mg",
    slug: "paracetamol-500mg",
    description: "ยาสามัญประจำบ้านสำหรับข้อมูลทดสอบร้านค้า",
    price: "120.00",
    imageUrl: "/images/payments/promptpay-qr.png",
    requiresPrescription: false,
    status: "active",
    inventory: {
      quantity: 8,
      reservedQuantity: 2,
      lowStockThreshold: 10
    }
  },
  {
    name: "Vitamin C Complex",
    slug: "vitamin-c-complex",
    description: "ผลิตภัณฑ์เสริมอาหารสำหรับทดสอบ catalog",
    price: "690.00",
    imageUrl: "/images/payments/promptpay-qr.png",
    requiresPrescription: false,
    status: "active",
    inventory: {
      quantity: 45,
      reservedQuantity: 4,
      lowStockThreshold: 12
    }
  },
  {
    name: "Clinical Retinoid Cream",
    slug: "clinical-retinoid-cream",
    description: "ผลิตภัณฑ์ที่ต้องอ้างอิงใบสั่งยา",
    price: "1290.00",
    imageUrl: "/images/payments/promptpay-qr.png",
    requiresPrescription: true,
    status: "active",
    inventory: {
      quantity: 5,
      reservedQuantity: 1,
      lowStockThreshold: 8
    }
  }
];

async function upsertUser(seedUser) {
  const { doctorProfile, pharmacistProfile, ...userData } = seedUser;
  const user = await prisma.user.upsert({
    where: {
      lineUserId: userData.lineUserId
    },
    update: userData,
    create: userData
  });

  if (doctorProfile) {
    await prisma.doctor.upsert({
      where: {
        userId: user.id
      },
      update: doctorProfile,
      create: {
        ...doctorProfile,
        userId: user.id
      }
    });
  }

  if (pharmacistProfile) {
    await prisma.pharmacist.upsert({
      where: {
        userId: user.id
      },
      update: pharmacistProfile,
      create: {
        ...pharmacistProfile,
        userId: user.id
      }
    });
  }

  return user;
}

async function upsertProducts(adminUserId) {
  const products = [];

  for (const seedProduct of seedProducts) {
    const { inventory, ...productData } = seedProduct;
    const product = await prisma.product.upsert({
      where: {
        slug: productData.slug
      },
      update: productData,
      create: productData
    });

    await prisma.inventory.upsert({
      where: {
        productId: product.id
      },
      update: {
        ...inventory,
        updatedById: adminUserId
      },
      create: {
        ...inventory,
        productId: product.id,
        updatedById: adminUserId
      }
    });

    products.push(product);
  }

  return products;
}

async function upsertConsultation({ customerId, doctorId }) {
  const existing = await prisma.consultation.findFirst({
    where: {
      patientId: customerId,
      doctorId,
      status: "scheduled"
    }
  });

  if (existing) {
    return prisma.consultation.update({
      where: {
        id: existing.id
      },
      data: {
        scheduledAt: new Date("2026-05-20T03:30:00.000Z"),
        zoomMeetingId: "seed-zoom-1001",
        zoomJoinUrl: "https://example.com/zoom/seed-1001",
        summary: "คำปรึกษาทดสอบสำหรับ dashboard และ prescription workflow"
      }
    });
  }

  return prisma.consultation.create({
    data: {
      patientId: customerId,
      doctorId,
      status: "scheduled",
      scheduledAt: new Date("2026-05-20T03:30:00.000Z"),
      zoomMeetingId: "seed-zoom-1001",
      zoomJoinUrl: "https://example.com/zoom/seed-1001",
      summary: "คำปรึกษาทดสอบสำหรับ dashboard และ prescription workflow"
    }
  });
}

async function upsertPrescription({ consultationId, customerId, doctorId, pharmacistId }) {
  const existing = await prisma.prescription.findFirst({
    where: {
      consultationId,
      patientId: customerId,
      status: "pending_verification"
    }
  });

  const data = {
    consultationId,
    patientId: customerId,
    doctorId,
    pharmacistId,
    status: "pending_verification",
    notes: "ใบสั่งยาทดสอบรอเภสัชกรตรวจสอบ"
  };

  if (existing) {
    return prisma.prescription.update({
      where: {
        id: existing.id
      },
      data
    });
  }

  return prisma.prescription.create({
    data
  });
}

async function upsertOrder({ customerId, productId, prescriptionId }) {
  const existing = await prisma.order.findFirst({
    where: {
      userId: customerId,
      status: "paid",
      items: {
        some: {
          productId
        }
      }
    },
    include: {
      items: true,
      payments: true,
      shipments: true
    }
  });

  const orderData = {
    userId: customerId,
    status: "paid",
    subtotal: "1290.00",
    discountTotal: "0.00",
    shippingTotal: "60.00",
    grandTotal: "1350.00"
  };

  const order =
    existing ??
    (await prisma.order.create({
      data: orderData
    }));

  if (existing) {
    await prisma.order.update({
      where: {
        id: existing.id
      },
      data: orderData
    });
  }

  const orderItem = await prisma.orderItem.findFirst({
    where: {
      orderId: order.id,
      productId
    }
  });

  if (orderItem) {
    await prisma.orderItem.update({
      where: {
        id: orderItem.id
      },
      data: {
        prescriptionId,
        quantity: 1,
        unitPrice: "1290.00",
        lineTotal: "1290.00"
      }
    });
  } else {
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId,
        prescriptionId,
        quantity: 1,
        unitPrice: "1290.00",
        lineTotal: "1290.00"
      }
    });
  }

  const payment = await prisma.payment.findFirst({
    where: {
      orderId: order.id,
      status: "pending_review"
    }
  });

  if (payment) {
    await prisma.payment.update({
      where: {
        id: payment.id
      },
      data: {
        amount: "1350.00",
        qrPayload: "seed-promptpay-payload",
        slipImageUrl: "/images/payments/promptpay-qr.png"
      }
    });
  } else {
    await prisma.payment.create({
      data: {
        orderId: order.id,
        method: "promptpay",
        amount: "1350.00",
        status: "pending_review",
        qrPayload: "seed-promptpay-payload",
        slipImageUrl: "/images/payments/promptpay-qr.png"
      }
    });
  }

  const shipment = await prisma.shipmentTracking.findFirst({
    where: {
      orderId: order.id,
      status: "preparing"
    }
  });

  if (shipment) {
    await prisma.shipmentTracking.update({
      where: {
        id: shipment.id
      },
      data: {
        carrier: "internal",
        trackingNumber: "SEED-TRACK-1001",
        eventsJson: [{ status: "preparing", label: "รอจัดเตรียมยา" }]
      }
    });
  } else {
    await prisma.shipmentTracking.create({
      data: {
        orderId: order.id,
        carrier: "internal",
        trackingNumber: "SEED-TRACK-1001",
        status: "preparing",
        eventsJson: [{ status: "preparing", label: "รอจัดเตรียมยา" }]
      }
    });
  }

  return order;
}

async function upsertCommunity({ adminUserId, customerId }) {
  const article = await prisma.article.upsert({
    where: {
      slug: "seed-hidden-vitamin-c-review"
    },
    update: {
      authorId: adminUserId,
      title: "บทความวิตามินซีที่ต้องตรวจทาน",
      body: "เนื้อหาทดสอบสำหรับ moderation queue",
      status: "hidden"
    },
    create: {
      authorId: adminUserId,
      title: "บทความวิตามินซีที่ต้องตรวจทาน",
      slug: "seed-hidden-vitamin-c-review",
      body: "เนื้อหาทดสอบสำหรับ moderation queue",
      status: "hidden"
    }
  });

  const comment = await prisma.comment.findFirst({
    where: {
      articleId: article.id,
      userId: customerId,
      status: "hidden"
    }
  });

  if (comment) {
    await prisma.comment.update({
      where: {
        id: comment.id
      },
      data: {
        body: "ความคิดเห็นทดสอบที่ถูกซ่อนเพื่อรอตรวจทาน"
      }
    });
  } else {
    await prisma.comment.create({
      data: {
        articleId: article.id,
        userId: customerId,
        body: "ความคิดเห็นทดสอบที่ถูกซ่อนเพื่อรอตรวจทาน",
        status: "hidden"
      }
    });
  }

  await prisma.like.upsert({
    where: {
      userId_articleId: {
        userId: customerId,
        articleId: article.id
      }
    },
    update: {},
    create: {
      userId: customerId,
      articleId: article.id
    }
  });

  return article;
}

async function upsertNotificationAndRewards({ customerId, orderId }) {
  const existingNotification = await prisma.notification.findFirst({
    where: {
      userId: customerId,
      type: "order",
      title: "คำสั่งซื้อรอจัดเตรียม"
    }
  });

  if (existingNotification) {
    await prisma.notification.update({
      where: {
        id: existingNotification.id
      },
      data: {
        body: "คำสั่งซื้อทดสอบเข้าสู่ขั้นตอนจัดเตรียมยา",
        metadataJson: { orderId }
      }
    });
  } else {
    await prisma.notification.create({
      data: {
        userId: customerId,
        type: "order",
        channel: "in_app",
        title: "คำสั่งซื้อรอจัดเตรียม",
        body: "คำสั่งซื้อทดสอบเข้าสู่ขั้นตอนจัดเตรียมยา",
        metadataJson: { orderId }
      }
    });
  }

  const existingReward = await prisma.rewardPoint.findFirst({
    where: {
      userId: customerId,
      sourceType: "order",
      sourceId: orderId,
      direction: "earn"
    }
  });

  if (existingReward) {
    await prisma.rewardPoint.update({
      where: {
        id: existingReward.id
      },
      data: {
        points: 120
      }
    });
  } else {
    await prisma.rewardPoint.create({
      data: {
        userId: customerId,
        sourceType: "order",
        sourceId: orderId,
        direction: "earn",
        points: 120,
        expiresAt: new Date("2027-05-13T00:00:00.000Z")
      }
    });
  }
}

async function main() {
  const users = new Map();

  for (const seedUser of seedUsers) {
    const user = await upsertUser(seedUser);
    users.set(seedUser.lineUserId, user);
  }

  const admin = users.get("seed-line-admin");
  const customer = users.get("seed-line-customer");
  const doctorUser = users.get("seed-line-doctor-approved");
  const pharmacistUser = users.get("seed-line-pharmacist-approved");

  const doctor = await prisma.doctor.findUniqueOrThrow({
    where: {
      userId: doctorUser.id
    }
  });
  const pharmacist = await prisma.pharmacist.findUniqueOrThrow({
    where: {
      userId: pharmacistUser.id
    }
  });
  const products = await upsertProducts(admin.id);
  const prescriptionProduct = products.find((product) => product.slug === "clinical-retinoid-cream") ?? products[0];
  const consultation = await upsertConsultation({
    customerId: customer.id,
    doctorId: doctor.id
  });
  const prescription = await upsertPrescription({
    consultationId: consultation.id,
    customerId: customer.id,
    doctorId: doctor.id,
    pharmacistId: pharmacist.id
  });
  const order = await upsertOrder({
    customerId: customer.id,
    productId: prescriptionProduct.id,
    prescriptionId: prescription.id
  });

  await upsertCommunity({
    adminUserId: admin.id,
    customerId: customer.id
  });
  await upsertNotificationAndRewards({
    customerId: customer.id,
    orderId: order.id
  });

  console.log(`Seeded ${seedUsers.length} users, ${seedProducts.length} products, and local workflow data.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
