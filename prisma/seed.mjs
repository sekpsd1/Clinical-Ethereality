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
    displayName: "พญ. กมลภัทร วิจักขณ์พันธ์",
    email: "doctor.approved@clinical-ethereality.test",
    role: "doctor",
    status: "active",
    avatarUrl: "/images/doctors/kamonpat.jpg",
    doctorProfile: {
      licenseNumber: "MD-CLIENT-REDACTED-001",
      specialty: "สูตินรีเวช และเวชศาสตร์มารดาและทารกในครรภ์",
      bio:
        "หมอกล้วย สูตินรีแพทย์ผู้เชี่ยวชาญด้านเวชศาสตร์มารดาและทารกในครรภ์ มีประสบการณ์การทำงานมากกว่า 10 ปี ให้คำปรึกษาออนไลน์ได้ทั้งวิดีโอและแชท",
      consultationFee: 800,
      status: "approved",
      approvedAt: new Date("2026-06-08T03:00:00.000Z")
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
    name: "HPV Home Test Kit 14 สายพันธุ์",
    slug: "hpv-home-test-14",
    category: "health-equipment",
    shortDescription: "ชุดตรวจ HPV จากปัสสาวะด้วยอุปกรณ์ Colli-Pee ครอบคลุม 14 สายพันธุ์",
    description:
      "ชุดตรวจ HPV จากปัสสาวะด้วยอุปกรณ์ Colli-Pee สำหรับตรวจหาเชื้อ HPV 14 สายพันธุ์ เลข อย. อยู่ระหว่างดำเนินการ ราคานี้รวม VAT แต่ไม่รวมค่าขนส่ง",
    price: "1200.00",
    imageUrl: "/images/products/colli-pee.jpg",
    requiresPrescription: false,
    status: "active",
    inventory: {
      quantity: 500,
      reservedQuantity: 0,
      lowStockThreshold: 50
    }
  },
  {
    name: "HPV Home Test Kit 18 สายพันธุ์",
    slug: "hpv-home-test-18",
    category: "health-equipment",
    shortDescription: "ชุดตรวจ HPV จากปัสสาวะด้วยอุปกรณ์ Colli-Pee ครอบคลุม 18 สายพันธุ์",
    description:
      "ชุดตรวจ HPV จากปัสสาวะด้วยอุปกรณ์ Colli-Pee สำหรับตรวจหาเชื้อ HPV 18 สายพันธุ์ เลข อย. อยู่ระหว่างดำเนินการ ราคานี้รวม VAT แต่ไม่รวมค่าขนส่ง",
    price: "1500.00",
    imageUrl: "/images/products/colli-pee.jpg",
    requiresPrescription: false,
    status: "active",
    inventory: {
      quantity: 500,
      reservedQuantity: 0,
      lowStockThreshold: 50
    }
  },
  {
    name: "HPV Home Test Kit 29 สายพันธุ์",
    slug: "hpv-home-test-29",
    category: "health-equipment",
    shortDescription: "ชุดตรวจ HPV จากปัสสาวะด้วยอุปกรณ์ Colli-Pee ครอบคลุม 29 สายพันธุ์",
    description:
      "ชุดตรวจ HPV จากปัสสาวะด้วยอุปกรณ์ Colli-Pee สำหรับตรวจหาเชื้อ HPV 29 สายพันธุ์ เลข อย. อยู่ระหว่างดำเนินการ ราคานี้รวม VAT แต่ไม่รวมค่าขนส่ง",
    price: "2000.00",
    imageUrl: "/images/products/colli-pee.jpg",
    requiresPrescription: false,
    status: "active",
    inventory: {
      quantity: 500,
      reservedQuantity: 0,
      lowStockThreshold: 50
    }
  },
  {
    name: "STIs Home Test Kit 14 รายการ",
    slug: "stis-home-test-14",
    category: "health-equipment",
    shortDescription: "ชุดตรวจโรคติดต่อทางเพศสัมพันธ์จากปัสสาวะ 14 รายการ พร้อมอุปกรณ์ Colli-Pee",
    description:
      "ชุดตรวจโรคติดต่อทางเพศสัมพันธ์จากปัสสาวะ 14 รายการ พร้อมอุปกรณ์เก็บตัวอย่าง Colli-Pee เลข อย. อยู่ระหว่างดำเนินการ ราคานี้รวม VAT แต่ไม่รวมค่าขนส่ง",
    price: "1500.00",
    imageUrl: "/images/products/colli-pee.jpg",
    requiresPrescription: false,
    status: "active",
    inventory: {
      quantity: 500,
      reservedQuantity: 0,
      lowStockThreshold: 50
    }
  },
  {
    name: "HPV Self Swab Kit 14 สายพันธุ์",
    slug: "hpv-self-swab-14",
    category: "health-equipment",
    shortDescription: "ชุดเก็บสิ่งส่งตรวจด้วยตนเองแบบ self swab สำหรับตรวจ HPV 14 สายพันธุ์",
    description:
      "ชุดเก็บสิ่งส่งตรวจด้วยตนเองแบบ self swab สำหรับตรวจหาเชื้อ HPV 14 สายพันธุ์ เลข อย. อยู่ระหว่างดำเนินการ ราคานี้รวม VAT แต่ไม่รวมค่าขนส่ง",
    price: "1200.00",
    imageUrl: "/images/products/self-swab.png",
    requiresPrescription: false,
    status: "active",
    inventory: {
      quantity: 500,
      reservedQuantity: 0,
      lowStockThreshold: 50
    }
  },
  {
    name: "HPV Self Swab Kit 18 สายพันธุ์",
    slug: "hpv-self-swab-18",
    category: "health-equipment",
    shortDescription: "ชุดเก็บสิ่งส่งตรวจด้วยตนเองแบบ self swab สำหรับตรวจ HPV 18 สายพันธุ์",
    description:
      "ชุดเก็บสิ่งส่งตรวจด้วยตนเองแบบ self swab สำหรับตรวจหาเชื้อ HPV 18 สายพันธุ์ เลข อย. อยู่ระหว่างดำเนินการ ราคานี้รวม VAT แต่ไม่รวมค่าขนส่ง",
    price: "1500.00",
    imageUrl: "/images/products/self-swab.png",
    requiresPrescription: false,
    status: "active",
    inventory: {
      quantity: 500,
      reservedQuantity: 0,
      lowStockThreshold: 50
    }
  },
  {
    name: "HPV Self Swab Kit 29 สายพันธุ์",
    slug: "hpv-self-swab-29",
    category: "health-equipment",
    shortDescription: "ชุดเก็บสิ่งส่งตรวจด้วยตนเองแบบ self swab สำหรับตรวจ HPV 29 สายพันธุ์",
    description:
      "ชุดเก็บสิ่งส่งตรวจด้วยตนเองแบบ self swab สำหรับตรวจหาเชื้อ HPV 29 สายพันธุ์ เลข อย. อยู่ระหว่างดำเนินการ ราคานี้รวม VAT แต่ไม่รวมค่าขนส่ง",
    price: "2000.00",
    imageUrl: "/images/products/self-swab.png",
    requiresPrescription: false,
    status: "active",
    inventory: {
      quantity: 500,
      reservedQuantity: 0,
      lowStockThreshold: 50
    }
  },
  {
    name: "STIs Self Swab Kit 14 รายการ",
    slug: "stis-self-swab-14",
    category: "health-equipment",
    shortDescription: "ชุดเก็บสิ่งส่งตรวจด้วยตนเองแบบ self swab สำหรับตรวจโรคติดต่อทางเพศสัมพันธ์ 14 รายการ",
    description:
      "ชุดเก็บสิ่งส่งตรวจด้วยตนเองแบบ self swab สำหรับตรวจโรคติดต่อทางเพศสัมพันธ์ 14 รายการ เลข อย. อยู่ระหว่างดำเนินการ ราคานี้รวม VAT แต่ไม่รวมค่าขนส่ง",
    price: "1500.00",
    imageUrl: "/images/products/self-swab.png",
    requiresPrescription: false,
    status: "active",
    inventory: {
      quantity: 500,
      reservedQuantity: 0,
      lowStockThreshold: 50
    }
  },
  {
    name: "STIs 14 + HPV 29 Home Test Bundle",
    slug: "stis-hpv-29-home-test-bundle",
    category: "health-equipment",
    shortDescription: "แพ็กเกจตรวจจากปัสสาวะ รวม STIs 14 รายการ และ HPV 29 สายพันธุ์",
    description:
      "แพ็กเกจรวม STIs 14 รายการ และ HPV 29 สายพันธุ์ สำหรับการตรวจจากปัสสาวะด้วยอุปกรณ์ Colli-Pee เลข อย. อยู่ระหว่างดำเนินการ ราคานี้รวม VAT แต่ไม่รวมค่าขนส่ง",
    price: "3500.00",
    imageUrl: "/images/products/colli-pee.jpg",
    requiresPrescription: false,
    status: "active",
    inventory: {
      quantity: 500,
      reservedQuantity: 0,
      lowStockThreshold: 50
    }
  },
  {
    name: "STIs 14 + HPV 29 Self Swab Bundle",
    slug: "stis-hpv-29-self-swab-bundle",
    category: "health-equipment",
    shortDescription: "แพ็กเกจ self swab รวม STIs 14 รายการ และ HPV 29 สายพันธุ์",
    description:
      "แพ็กเกจรวม STIs 14 รายการ และ HPV 29 สายพันธุ์ สำหรับชุดเก็บสิ่งส่งตรวจด้วยตนเองแบบ self swab เลข อย. อยู่ระหว่างดำเนินการ ราคานี้รวม VAT แต่ไม่รวมค่าขนส่ง",
    price: "3500.00",
    imageUrl: "/images/products/self-swab.png",
    requiresPrescription: false,
    status: "active",
    inventory: {
      quantity: 500,
      reservedQuantity: 0,
      lowStockThreshold: 50
    }
  }
];

const legacyProductSlugs = ["paracetamol-500mg", "vitamin-c-complex", "clinical-retinoid-cream"];

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

  await prisma.product.updateMany({
    where: {
      slug: {
        in: legacyProductSlugs
      }
    },
    data: {
      status: "archived"
    }
  });

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

async function upsertConsultationMessages({ consultationId, customerId, doctorUserId }) {
  const messages = [
    {
      consultationId,
      senderId: doctorUserId,
      body: "สวัสดีค่ะ วันนี้มีอาการหรือคำถามอะไรที่อยากให้หมอช่วยดูเป็นพิเศษไหมคะ",
      createdAt: new Date("2026-05-20T03:31:00.000Z")
    },
    {
      consultationId,
      senderId: customerId,
      body: "อยากปรึกษาเรื่องผลตรวจและขั้นตอนดูแลต่อหลังซื้อชุดตรวจค่ะ",
      createdAt: new Date("2026-05-20T03:32:00.000Z")
    },
    {
      consultationId,
      senderId: doctorUserId,
      body: "ได้ค่ะ หมอจะดูประวัติและแบบประเมินก่อน แล้วสรุปแนวทางให้ในห้องปรึกษานี้",
      createdAt: new Date("2026-05-20T03:33:00.000Z")
    }
  ];

  await prisma.consultationMessage.deleteMany({
    where: {
      consultationId,
      body: {
        in: messages.map((message) => message.body)
      }
    }
  });

  await prisma.consultationMessage.createMany({
    data: messages
  });
}

async function upsertDoctorAvailability(doctorId) {
  await prisma.doctorAvailability.updateMany({
    where: {
      doctorId
    },
    data: {
      isActive: false
    }
  });

  const slots = [1, 2, 3, 4].map((weekday) => ({
    weekday,
    startTime: "17:00",
    endTime: "21:00",
    slotMinutes: 15,
    isActive: true,
    notes: "รับปรึกษาออนไลน์ได้ทั้งวิดีโอและแชท"
  }));

  for (const slot of slots) {
    const existing = await prisma.doctorAvailability.findFirst({
      where: {
        doctorId,
        weekday: slot.weekday,
        startTime: slot.startTime,
        endTime: slot.endTime
      }
    });

    if (existing) {
      await prisma.doctorAvailability.update({
        where: {
          id: existing.id
        },
        data: slot
      });
    } else {
      await prisma.doctorAvailability.create({
        data: {
          doctorId,
          ...slot
        }
      });
    }
  }
}

async function upsertPrescription({ consultationId, customerId, doctorId, pharmacistId }) {
  const existing = await prisma.prescription.findFirst({
    where: {
      consultationId,
      patientId: customerId
    }
  });

  const data = {
    consultationId,
    patientId: customerId,
    doctorId,
    pharmacistId,
    status: "verified",
    verifiedAt: new Date("2026-06-08T10:30:00.000Z"),
    notes: "ใบสั่งยาทดสอบจากแพทย์ในระบบ ใช้สำหรับสั่งซื้อชุดตรวจตาม workflow คลินิกโดยตรงโดยไม่ต้องตรวจเอกสารซ้ำ"
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

async function upsertOrder({ customerId, product, prescriptionId }) {
  const unitPrice = Number(product.price);
  const shippingTotal = 30;
  const grandTotal = unitPrice + shippingTotal;

  const existing = await prisma.order.findFirst({
    where: {
      userId: customerId,
      status: "paid",
      items: {
        some: {
          productId: product.id
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
    subtotal: unitPrice.toFixed(2),
    discountTotal: "0.00",
    shippingTotal: shippingTotal.toFixed(2),
    grandTotal: grandTotal.toFixed(2)
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
      productId: product.id
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
        unitPrice: unitPrice.toFixed(2),
        lineTotal: unitPrice.toFixed(2)
      }
    });
  } else {
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        prescriptionId,
        quantity: 1,
        unitPrice: unitPrice.toFixed(2),
        lineTotal: unitPrice.toFixed(2)
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
        amount: grandTotal.toFixed(2),
        qrPayload: "seed-promptpay-payload",
        slipImageUrl: "/images/payments/promptpay-qr.png"
      }
    });
  } else {
    await prisma.payment.create({
      data: {
        orderId: order.id,
        method: "promptpay",
        amount: grandTotal.toFixed(2),
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
  const publishedArticle = await prisma.article.upsert({
    where: {
      slug: "vitamin-c-tips"
    },
    update: {
      authorId: adminUserId,
      title: "แชร์เคล็ดลับการทานวิตามินซีให้ได้ผลดีที่สุด",
      category: "วิตามิน & อาหารเสริม",
      body:
        "การรับประทานวิตามินซีให้เกิดประสิทธิภาพสูงสุด แนะนำให้รับประทานหลังอาหารเช้า เพราะร่างกายสามารถดูดซึมไปใช้ได้ทันทีตลอดวัน และควรแบ่งรับประทานวันละ 2 ครั้งเพื่อรักษาระดับวิตามินในเลือดให้คงที่ หากมีโรคประจำตัวหรือใช้ยาประจำควรปรึกษาแพทย์หรือเภสัชกรก่อนเริ่มอาหารเสริมใหม่",
      status: "published",
      publishedAt: new Date("2026-05-03T03:00:00.000Z")
    },
    create: {
      authorId: adminUserId,
      title: "แชร์เคล็ดลับการทานวิตามินซีให้ได้ผลดีที่สุด",
      slug: "vitamin-c-tips",
      category: "วิตามิน & อาหารเสริม",
      body:
        "การรับประทานวิตามินซีให้เกิดประสิทธิภาพสูงสุด แนะนำให้รับประทานหลังอาหารเช้า เพราะร่างกายสามารถดูดซึมไปใช้ได้ทันทีตลอดวัน และควรแบ่งรับประทานวันละ 2 ครั้งเพื่อรักษาระดับวิตามินในเลือดให้คงที่ หากมีโรคประจำตัวหรือใช้ยาประจำควรปรึกษาแพทย์หรือเภสัชกรก่อนเริ่มอาหารเสริมใหม่",
      status: "published",
      publishedAt: new Date("2026-05-03T03:00:00.000Z")
    }
  });

  const visibleComment = await prisma.comment.findFirst({
    where: {
      articleId: publishedArticle.id,
      userId: customerId,
      status: "visible"
    }
  });

  if (visibleComment) {
    await prisma.comment.update({
      where: {
        id: visibleComment.id
      },
      data: {
        body: "ขอบคุณสำหรับข้อมูลครับ มีประโยชน์มากเลย"
      }
    });
  } else {
    await prisma.comment.create({
      data: {
        articleId: publishedArticle.id,
        userId: customerId,
        body: "ขอบคุณสำหรับข้อมูลครับ มีประโยชน์มากเลย",
        status: "visible"
      }
    });
  }

  await prisma.like.upsert({
    where: {
      userId_articleId: {
        userId: customerId,
        articleId: publishedArticle.id
      }
    },
    update: {},
    create: {
      userId: customerId,
      articleId: publishedArticle.id
    }
  });

  const customerPost = await prisma.article.upsert({
    where: {
      slug: "community-wellness-routine"
    },
    update: {
      authorId: customerId,
      title: "แบ่งปันกิจวัตรดูแลตัวเองในวันที่งานยุ่ง",
      category: "การดูแลผิว",
      body:
        "ฉันจัดเวลาพักจากหน้าจอ ดื่มน้ำ และดูแลผิวตามคำแนะนำทั่วไป โดยไม่แชร์ข้อมูลการรักษาหรือข้อมูลสุขภาพส่วนตัว หากมีอาการผิดปกติควรปรึกษาผู้เชี่ยวชาญโดยตรง",
      status: "published",
      publishedAt: new Date("2026-05-04T03:00:00.000Z")
    },
    create: {
      authorId: customerId,
      title: "แบ่งปันกิจวัตรดูแลตัวเองในวันที่งานยุ่ง",
      slug: "community-wellness-routine",
      category: "การดูแลผิว",
      body:
        "ฉันจัดเวลาพักจากหน้าจอ ดื่มน้ำ และดูแลผิวตามคำแนะนำทั่วไป โดยไม่แชร์ข้อมูลการรักษาหรือข้อมูลสุขภาพส่วนตัว หากมีอาการผิดปกติควรปรึกษาผู้เชี่ยวชาญโดยตรง",
      status: "published",
      publishedAt: new Date("2026-05-04T03:00:00.000Z")
    }
  });

  await prisma.savedArticle.upsert({
    where: {
      userId_articleId: {
        userId: customerId,
        articleId: publishedArticle.id
      }
    },
    update: {},
    create: {
      userId: customerId,
      articleId: publishedArticle.id
    }
  });

  const seededReport = await prisma.communityReport.findFirst({
    where: {
      reporterId: adminUserId,
      articleId: customerPost.id
    },
    select: {
      id: true
    }
  });

  if (seededReport) {
    await prisma.communityReport.update({
      where: {
        id: seededReport.id
      },
      data: {
        reason: "privacy",
        details: "รายการทดสอบคิว moderation โดยเนื้อหายังคงเผยแพร่จนกว่าจะตรวจ",
        status: "pending",
        reviewerId: null,
        reviewedAt: null,
        resolutionAction: null
      }
    });
  } else {
    await prisma.communityReport.create({
      data: {
        reporterId: adminUserId,
        articleId: customerPost.id,
        reason: "privacy",
        details: "รายการทดสอบคิว moderation โดยเนื้อหายังคงเผยแพร่จนกว่าจะตรวจ",
        status: "pending"
      }
    });
  }

  const article = await prisma.article.upsert({
    where: {
      slug: "seed-hidden-vitamin-c-review"
    },
    update: {
      authorId: adminUserId,
      title: "บทความวิตามินซีที่ต้องตรวจทาน",
      category: "วิตามิน & อาหารเสริม",
      body: "เนื้อหาทดสอบสำหรับ moderation queue",
      status: "hidden"
    },
    create: {
      authorId: adminUserId,
      title: "บทความวิตามินซีที่ต้องตรวจทาน",
      slug: "seed-hidden-vitamin-c-review",
      category: "วิตามิน & อาหารเสริม",
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
  await upsertDoctorAvailability(doctor.id);
  const prescriptionProduct = products.find((product) => product.slug === "hpv-home-test-14") ?? products[0];
  const consultation = await upsertConsultation({
    customerId: customer.id,
    doctorId: doctor.id
  });
  await upsertConsultationMessages({
    consultationId: consultation.id,
    customerId: customer.id,
    doctorUserId: doctorUser.id
  });
  const prescription = await upsertPrescription({
    consultationId: consultation.id,
    customerId: customer.id,
    doctorId: doctor.id,
    pharmacistId: pharmacist.id
  });
  const order = await upsertOrder({
    customerId: customer.id,
    product: prescriptionProduct,
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
