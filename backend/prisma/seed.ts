/**
 * Seed data for OrderHub.
 *
 * Design goals:
 * - Numbers must reconcile: every order's subtotal/total is the sum of its lines,
 *   and the dashboard aggregates are computed from these rows, not hard-coded.
 * - Dates spread over the last 30 days so the trend chart has a real shape.
 * - Older orders are mostly completed, recent ones are pending/paid — that is
 *   what an actual wholesale book looks like.
 * - A handful of products sit at or below the low-stock threshold so the
 *   warning state is visible without clicking around.
 */
// Loads .env before PrismaClient resolves DATABASE_URL. `prisma db seed` injects
// the variables itself, but `tsx prisma/seed.ts` run directly does not.
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@orderhub.demo';
const STAFF_EMAIL = 'staff@orderhub.demo';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Demo1234';
const STAFF_PASSWORD = process.env.SEED_STAFF_PASSWORD ?? 'Demo1234';

// [name, company, nameEn, companyEn, contact, phone, address]
const CUSTOMERS = [
  ['张三贸易', '张三贸易有限公司', 'Zhangsan Trading', 'Zhangsan Trading Co., Ltd.', '张伟', '13800138001', '上海市浦东新区张江路 88 号 3 栋'],
  ['李氏商行', '李氏商行', 'Li Trading House', 'Li Trading House', '李娜', '13900139002', '杭州市余杭区文一西路 1218 号'],
  ['王五批发', '王五批发中心', 'Wangwu Wholesale', 'Wangwu Wholesale Center', '王强', '13700137003', '广州市白云区机场路 302 号'],
  ['赵六零售', '赵六便利连锁', 'Zhaoliu Retail', 'Zhaoliu Convenience Chain', '赵敏', '13600136004', '成都市武侯区科华北路 62 号'],
  ['恒达建材', '恒达建材集团', 'Hengda Building Materials', 'Hengda BM Group', '陈刚', '13500135005', '南京市江宁区将军大道 199 号'],
  ['金桥五金', '金桥五金机电', 'Jinqiao Hardware', 'Jinqiao Hardware & Electrics', '刘洋', '13400134006', '苏州市工业园区星湖街 328 号'],
  ['南方日用品', '南方日用品有限公司', 'Nanfang Daily Goods', 'Nanfang Daily Goods Co., Ltd.', '黄丽', '13300133007', '东莞市南城区科技路 7 号'],
  ['华美文具', '华美文具有限公司', 'Huamei Stationery', 'Huamei Stationery Co., Ltd.', '周涛', '13200132008', '宁波市鄞州区四明中路 108 号'],
  ['优品家居', '优品家居生活馆', 'Youpin Home', 'Youpin Home Living', '吴静', '13100131009', '武汉市洪山区珞喻路 152 号'],
  ['启明电子', '启明电子科技', 'Qiming Electronics', 'Qiming Electronic Tech', '郑凯', '13000130010', '深圳市南山区科技园南区 9 栋'],
  ['天禾食品', '天禾食品有限公司', 'Tianhe Food', 'Tianhe Food Co., Ltd.', '孙芳', '18900189011', '济南市历下区经十路 118 号'],
  ['瑞丰服饰', '瑞丰服饰贸易', 'Ruifeng Apparel', 'Ruifeng Apparel Trading', '马超', '18800188012', '泉州市丰泽区东海大街 55 号'],
  ['兴隆电器', '兴隆电器城', 'Xinglong Appliances', 'Xinglong Electric City', '朱琳', '18700187013', '长沙市岳麓区枫林三路 238 号'],
  ['恒信汽配', '恒信汽配商行', 'Hengxin Auto Parts', 'Hengxin Auto Parts Store', '胡军', '18600186014', '郑州市金水区花园路 66 号'],
  ['宏图包装', '宏图包装材料厂', 'Hongtu Packaging', 'Hongtu Packaging Materials', '郭雪', '18500185015', '佛山市顺德区乐从镇 12 号'],
  ['安泰医疗', '安泰医疗器械', 'Antai Medical', 'Antai Medical Devices', '何平', '18400184016', '西安市雁塔区高新四路 9 号'],
  ['绿源农业', '绿源农业合作社', 'Lvyuan Agriculture', 'Lvyuan Agri Cooperative', '高峰', '18300183017', '合肥市蜀山区长江西路 456 号'],
  ['中远物流', '中远物流仓储', 'Zhongyuan Logistics', 'Zhongyuan Logistics & Storage', '林涛', '18200182018', '天津市滨海新区新港路 88 号'],
  ['金鹏玩具', '金鹏玩具礼品', 'Jinpeng Toys', 'Jinpeng Toys & Gifts', '罗芳', '18100181019', '汕头市澄海区莱美路 33 号'],
  ['盛世礼品', '盛世礼品定制', 'Shengshi Gifts', 'Shengshi Gift Custom', '梁宇', '18000180020', '厦门市思明区湖滨南路 101 号'],
] as const;

// [sku, name, nameEn, category, unitPrice, stock]
const PRODUCTS = [
  ['OFF-1001', 'A4 复印纸 70g（500 张）', 'A4 Copy Paper 70g (500 sheets)', '办公用品', 22.5, 320],
  ['OFF-1002', '中性签字笔 0.5mm（12 支）', 'Gel Pen 0.5mm (12 pk)', '办公用品', 18.0, 240],
  ['OFF-1003', 'A4 双强力文件夹', 'A4 Heavy-Duty Folder', '办公用品', 9.9, 3],
  ['OFF-1004', '重型订书机 12 号', 'Heavy-Duty Stapler No.12', '办公用品', 46.0, 68],
  ['OFF-1005', '白板笔（10 支装）', 'Whiteboard Marker (10 pk)', '办公用品', 32.0, 2],
  ['OFF-1006', '彩色便利贴 76×76', 'Color Sticky Notes 76×76', '办公用品', 6.5, 410],
  ['OFF-1007', '牛皮纸档案盒', 'Kraft Archive Box', '办公用品', 12.8, 156],
  ['HOM-2001', '折叠收纳箱 55L', 'Folding Storage Box 55L', '家居日用', 68.0, 92],
  ['HOM-2002', '免手洗平板拖把', 'Hands-Free Flat Mop', '家居日用', 89.0, 44],
  ['HOM-2003', '加厚垃圾袋（100 只）', 'Extra-Thick Trash Bags (100 pk)', '家居日用', 15.9, 520],
  ['HOM-2004', '防滑衣架（20 个）', 'Non-Slip Hangers (20 pk)', '家居日用', 26.0, 180],
  ['HOM-2005', '双层玻璃水杯 350ml', 'Double-Wall Glass Cup 350ml', '家居日用', 39.0, 4],
  ['HOM-2006', '纯棉毛巾三条装', 'Cotton Towels (3 pk)', '家居日用', 55.0, 210],
  ['FOD-3001', '天然矿泉水 550ml×24', 'Natural Mineral Water 550ml×24', '食品饮料', 36.0, 380],
  ['FOD-3002', '中度烘焙咖啡豆 1kg', 'Medium Roast Coffee Beans 1kg', '食品饮料', 168.0, 36],
  ['FOD-3003', '锡兰红茶包 100 袋', 'Ceylon Black Tea Bags (100)', '食品饮料', 78.0, 120],
  ['FOD-3004', '黄油曲奇礼盒', 'Butter Cookie Gift Box', '食品饮料', 98.0, 64],
  ['FOD-3005', '每日坚果 30 包', 'Daily Nuts (30 packs)', '食品饮料', 129.0, 5],
  ['ELE-4001', 'Type-C 快充数据线 1.5m', 'USB-C Fast-Charge Cable 1.5m', '电子配件', 29.9, 600],
  ['ELE-4002', '无线静音鼠标', 'Wireless Silent Mouse', '电子配件', 79.0, 130],
  ['ELE-4003', '机械键盘 87 键', 'Mechanical Keyboard 87-Key', '电子配件', 329.0, 42],
  ['ELE-4004', '六位插线板 3m', '6-Outlet Power Strip 3m', '电子配件', 55.0, 260],
  ['ELE-4005', '10000mAh 移动电源', 'Power Bank 10000mAh', '电子配件', 149.0, 88],
  ['ELE-4006', '入耳式有线耳机', 'Wired In-Ear Earphones', '电子配件', 39.0, 300],
  ['ELE-4007', '1080P 网络摄像头', '1080P Webcam', '电子配件', 189.0, 1],
  ['ELE-4008', '双频无线路由器', 'Dual-Band WiFi Router', '电子配件', 259.0, 54],
  ['ELE-4009', '2.5 英寸硬盘盒', '2.5" HDD Enclosure', '电子配件', 69.0, 76],
  ['ELE-4010', '高速读卡器 USB3.0', 'USB 3.0 Card Reader', '电子配件', 45.0, 140],
  ['ELE-4011', '铝合金笔记本支架', 'Aluminum Laptop Stand', '电子配件', 128.0, 62],
  ['ELE-4012', '桌面理线器套装', 'Desktop Cable Management Kit', '电子配件', 25.0, 330],
] as const;

/** Deterministic PRNG so re-seeding gives the same screenshots. */
let seed = 20_261_020;
const rnd = () => {
  seed = (seed * 16807) % 2_147_483_647;
  return seed / 2_147_483_647;
};
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;
const int = (min: number, max: number) => Math.floor(min + rnd() * (max - min + 1));

const STATUS_WEIGHTS: [string, number][] = [
  ['completed', 0.46],
  ['shipped', 0.16],
  ['paid', 0.13],
  ['pending', 0.15],
  ['cancelled', 0.1],
];

function weightedStatus(): 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled' {
  const r = rnd();
  let acc = 0;
  for (const [status, w] of STATUS_WEIGHTS) {
    acc += w;
    if (r <= acc) return status as never;
  }
  return 'completed';
}

const dayKey = (d: Date) =>
  `#${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate(),
  ).padStart(2, '0')}-`;

async function main() {
  console.log('→ clearing existing data');
  await prisma.auditLog.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();

  console.log('→ users');
  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      name: '陈明远',
      nameEn: 'Mingyuan Chen',
      role: 'admin',
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
    },
  });
  const staff = await prisma.user.create({
    data: {
      email: STAFF_EMAIL,
      name: '林小雨',
      nameEn: 'Xiaoyu Lin',
      role: 'staff',
      passwordHash: await bcrypt.hash(STAFF_PASSWORD, 10),
    },
  });

  console.log('→ customers');
  const customers = [];
  for (const [name, company, nameEn, companyEn, contact, phone, address] of CUSTOMERS) {
    customers.push(
      await prisma.customer.create({
        data: {
          name,
          nameEn,
          company,
          companyEn,
          phone,
          address,
          email: `contact${customers.length + 1}@${name.replace(/[^\w]/g, '') || 'demo'}.example`,
          note: contact ? `联系人：${contact}` : null,
        },
      }),
    );
  }

  console.log('→ products');
  const products = [];
  for (const [sku, name, nameEn, category, price, stock] of PRODUCTS) {
    products.push(
      await prisma.product.create({
        data: { sku, name, nameEn, category, unitPrice: new Prisma.Decimal(price), stock },
      }),
    );
  }

  console.log('→ orders');
  const perDay = new Map<string, number>();
  const ORDER_COUNT = 64;
  let created = 0;

  for (let i = 0; i < ORDER_COUNT; i++) {
    // Spread over 30 days, weighted towards recent days.
    const daysAgo = Math.floor(Math.pow(rnd(), 1.7) * 30);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);
    createdAt.setHours(8 + int(0, 10), int(0, 59), int(0, 59), 0);

    // Older orders have had time to ship and settle.
    let status = weightedStatus();
    if (daysAgo > 20 && (status === 'pending' || status === 'paid')) status = 'completed';
    if (daysAgo < 2 && status === 'completed' && rnd() < 0.6) status = 'shipped';

    const lineCount = int(1, 5);
    const chosen = new Set<number>();
    while (chosen.size < lineCount) chosen.add(Math.floor(rnd() * products.length));

    let subtotal = new Prisma.Decimal(0);
    const lines = [...chosen].map((idx) => {
      const product = products[idx]!;
      const quantity = int(1, 18);
      const lineTotal = product.unitPrice.mul(quantity);
      subtotal = subtotal.add(lineTotal);
      return { product, quantity, unitPrice: product.unitPrice, subtotal: lineTotal };
    });

    let discount = new Prisma.Decimal(0);
    if (rnd() < 0.35) {
      const candidate = new Prisma.Decimal(int(1, 12) * 10);
      discount = candidate.lessThan(subtotal) ? candidate : new Prisma.Decimal(0);
    }
    const total = subtotal.sub(discount);

    const key = dayKey(createdAt);
    const seq = (perDay.get(key) ?? 0) + 1;
    perDay.set(key, seq);
    const orderNo = key + String(seq).padStart(3, '0');

    const order = await prisma.order.create({
      data: {
        orderNo,
        customerId: pick(customers).id,
        status,
        subtotal,
        discount,
        total,
        createdBy: rnd() < 0.5 ? admin.id : staff.id,
        createdAt,
        updatedAt: createdAt,
        note: rnd() < 0.2 ? '客户要求上午送达' : null,
        items: {
          create: lines.map((l) => ({
            productId: l.product.id,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            subtotal: l.subtotal,
          })),
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: order.createdBy,
        action: 'create',
        entity: 'order',
        entityId: order.id,
        createdAt,
        detail: { orderNo, total: Number(total), lines: lines.length },
      },
    });

    // Walk the order through the states it has already passed, so the audit
    // trail tells the same story as the status.
    const path: string[] =
      status === 'cancelled'
        ? ['pending', 'cancelled']
        : ['pending', 'paid', 'shipped', 'completed'].slice(
            0,
            ['pending', 'paid', 'shipped', 'completed'].indexOf(status) + 1,
          );

    for (let s = 1; s < path.length; s++) {
      await prisma.auditLog.create({
        data: {
          userId: admin.id,
          action: 'update',
          entity: 'order',
          entityId: order.id,
          createdAt: new Date(createdAt.getTime() + s * 3_600_000 * int(2, 30)),
          detail: { field: 'status', from: path[s - 1], to: path[s] },
        },
      });
    }

    created++;
  }

  // Give a few customers a visible debt profile.
  const summary = await prisma.order.aggregate({
    _count: { _all: true },
    _sum: { total: true },
  });

  console.log('');
  console.log('  OrderHub seed complete');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  users      ${2}   (admin, staff)`);
  console.log(`  customers  ${customers.length}`);
  console.log(`  products   ${products.length}   (5 at or below low-stock threshold)`);
  console.log(`  orders     ${created}   worth ¥${Number(summary._sum.total ?? 0).toFixed(2)}`);
  console.log(`  audit      ${await prisma.auditLog.count()} entries`);
  console.log('  ─────────────────────────────────────────────');
  console.log(`  admin  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  staff  ${STAFF_EMAIL} / ${STAFF_PASSWORD}`);
  console.log('');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
