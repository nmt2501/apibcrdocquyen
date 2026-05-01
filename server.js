const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// ================== DANH SÁCH BÀN ==================
const banThuong = Array.from({ length: 10 }, (_, i) =>
  `BAN${(i + 1).toString().padStart(2, '0')}`
);
const banC = Array.from({ length: 16 }, (_, i) =>
  `C${(i + 1).toString().padStart(2, '0')}`
);
const banList = [...banThuong, ...banC];

// ================== 10G1 NÂNG CẤP ==================
function duDoan10g1(ket_qua) {
    const clean = ket_qua.replace(/[^PB]/g, '');
    const last10 = clean.slice(-10);

    if (!last10) return null;

    let P = 0, B = 0;

    for (const c of last10) {
        if (c === 'P') P++;
        else if (c === 'B') B++;
    }

    // =========================
    // QUY ĐỔI NHÀ
    // =========================
    const nhaCon = 'Nhà Con';   // P
    const nhaCai = 'Nhà Cái';   // B

    // =========================
    // 1. THEO TỶ LỆ XU HƯỚNG
    // =========================
    const total = P + B;

    const pRate = P / total;
    const bRate = B / total;

    // =========================
    // 2. XU HƯỚNG NGẮN HẠN (3 PHIÊN CUỐI)
    // =========================
    const last3 = last10.slice(-3);
    let P3 = 0, B3 = 0;

    for (const c of last3) {
        if (c === 'P') P3++;
        if (c === 'B') B3++;
    }

    // =========================
    // 3. DECISION LOGIC
    // =========================
    let scoreP = pRate * 60 + P3 * 10;
    let scoreB = bRate * 60 + B3 * 10;

    // bias nhẹ theo phiên gần nhất
    const last = last10.slice(-1);
    if (last === 'P') scoreP += 5;
    if (last === 'B') scoreB += 5;

    // =========================
    // 4. OUTPUT
    // =========================
    if (scoreP > scoreB) return nhaCon;
    if (scoreB > scoreP) return nhaCai;

    // fallback
    return last === 'P' ? nhaCon : nhaCai;
}

// ================== NHẬN DIỆN CẦU ==================
function phatHienCau(ket_qua) {
    const clean = ket_qua.replace(/[^PB]/g, '');
    const last10 = clean.slice(-10);

    const nhaCon = 'Nhà Con'; // P
    const nhaCai = 'Nhà Cái'; // B

    if (last10.length < 4) {
        return { loaiCau: 'Không rõ', du_doan: null };
    }

    // =========================
    // 1. CẦU BỆT
    // =========================
    const lastChar = last10.slice(-1);

    if (last10.slice(-3).split('').every(v => v === lastChar)) {
        return {
            loaiCau: 'Cầu bệt',
            du_doan: lastChar === 'P' ? nhaCon : nhaCai
        };
    }

    // =========================
    // 2. CẦU 1-1 / 2-2 / 3-3...
    // =========================
    function detectRepeatPair(n) {
        const patternP = Array(n).fill(0).map((_, i) => i % 2 === 0 ? 'P' : 'B').join('');
        const patternB = Array(n).fill(0).map((_, i) => i % 2 === 0 ? 'B' : 'P').join('');

        const last = last10.slice(-n);

        if (last === patternP) return 'P';
        if (last === patternB) return 'B';
        return null;
    }

    const repeatLevels = [2, 4, 6, 8];

    for (let n of repeatLevels) {
        const res = detectRepeatPair(n);
        if (res) {
            return {
                loaiCau: `Cầu 1-1 / nhịp ${n / 2}-${n / 2}`,
                du_doan: res === 'P' ? nhaCon : nhaCai
            };
        }
    }

    // =========================
    // 3. CẦU CHU KỲ
    // =========================
    function detectCycle(len) {
        const seg = last10.slice(-len);
        const half = len / 2;

        const a = seg.slice(0, half);
        const b = seg.slice(half);

        if (a === b) return null;

        if (seg === a + b) return a[0];
        if (seg === b + a) return b[0];

        return null;
    }

    const cycles = [4, 6, 8];

    for (let n of cycles) {
        const res = detectCycle(n);
        if (res) {
            return {
                loaiCau: `Cầu chu kỳ ${n}`,
                du_doan: res === 'P' ? nhaCon : nhaCai
            };
        }
    }

    // =========================
    // 4. NGHIÊNG
    // =========================
    const P = (last10.match(/P/g) || []).length;
    const B = (last10.match(/B/g) || []).length;

    if (P >= B + 4) {
        return { loaiCau: 'Cầu nghiêng Con', du_doan: nhaCon };
    }

    if (B >= P + 4) {
        return { loaiCau: 'Cầu nghiêng Cái', du_doan: nhaCai };
    }

    return { loaiCau: 'Không rõ', du_doan: null };
}

// ================== ĐỘ TIN CẬY (UPGRADE) ==================
function tinhDoTinCay(ket_qua, loai_cau, du_doan) {
    const clean = ket_qua.replace(/[^PB]/g, '');
    const last10 = clean.slice(-10);

    let score = 50;

    // =========================
    // 1. MAP LOẠI CẦU
    // =========================
    const mapScore = {
        'Cầu bệt': 25,
        'Cầu 1-1': 18,
        'Cầu chu kỳ': 15,
        'Cầu nghiêng Con': 8,
        'Cầu nghiêng Cái': 8,
        'Không rõ': -10
    };

    for (const key in mapScore) {
        if (loai_cau.includes(key)) {
            score += mapScore[key];
            break;
        }
    }

    // =========================
    // 2. ĐẾM P/B
    // =========================
    const P = (last10.match(/P/g) || []).length;
    const B = (last10.match(/B/g) || []).length;
    const total = P + B;

    // =========================
    // 3. KHỚP DỰ ĐOÁN
    // =========================
    if (du_doan === 'P') {
        score += (P / total) * 20;
        score += P > B ? 10 : -5;
    }

    if (du_doan === 'B') {
        score += (B / total) * 20;
        score += B > P ? 10 : -5;
    }

    // =========================
    // 4. STREAK
    // =========================
    const lastChar = last10.slice(-1);
    const streak = last10.split('').reverse().findIndex(c => c !== lastChar) + 1;
    if (streak > 3) score += Math.min(streak * 2, 15);

    // =========================
    // 5. DATA LENGTH
    // =========================
    if (last10.length < 6) score -= 10;
    if (last10.length >= 10) score += 5;

    // =========================
    // 6. NOISE NHẸ
    // =========================
    score += (Math.random() - 0.5) * 3;

    // =========================
    // CHUẨN HÓA
    // =========================
    score = Math.max(30, Math.min(95, score));

    // =========================
    // 7. QUY ĐỔI NHÀ
    // =========================
    const nha = du_doan === 'P' ? 'Nhà Con' : 'Nhà Cái';

    return {
        do_tin_cay: score.toFixed(2) + '%'
    };
}

// ================== FETCH + CACHE ==================
let cache = null;
let lastFetch = 0;

async function fetchAll() {
    if (cache && Date.now() - lastFetch < 3000) return cache;
    const res = await axios.get('http://36.50.55.230:5916/bcr/all');
    cache = res.data;
    lastFetch = Date.now();
    return cache;
}

// ================== CHUẨN HOÁ BÀN ==================
function normalizeBanId(str = '') {
    const s = str.toString().toUpperCase().trim();

    if (/^\d+$/.test(s)) return `BAN${s.padStart(2, '0')}`;
    if (/^C\d+$/.test(s.replace(/O/g, '0')))
        return s.replace(/O/g, '0').replace(/^C(\d)$/, 'C0$1');
    if (/^BAN\d+$/.test(s)) return s.replace(/^BAN(\d)$/, 'BAN0$1');

    return s.replace(/\s+/g, '');
}

// ================== LẤY 1 BÀN ==================
async function getBan(banId) {
    const all = await fetchAll();
    const banNorm = normalizeBanId(banId);

    const raw = all.find(item =>
        normalizeBanId(item.ban) === banNorm
    );

    if (!raw) {
        return { ban: banId, trang_thai: 'Không có dữ liệu' };
    }

    const ket_qua = raw.ket_qua || '';
    const cau = phatHienCau(ket_qua);
    const du_doan = cau.du_doan || duDoan10g1(ket_qua);
    const do_tin_cay = tinhDoTinCay(ket_qua, cau.loaiCau, du_doan);

    return {
        ban: raw.ban.toString(),   // ✅ ban gốc: "1", "10", "C01"
        ket_qua,
        loai_cau: cau.loaiCau,
        du_doan,
        do_tin_cay
    };
}

// ================== API TỪNG BÀN ==================
banList.forEach(ban => {
    app.get(`/api/${ban.toLowerCase()}`, async (req, res) => {
        res.json(await getBan(ban));
    });
});

// ================== API TẤT CẢ ==================
app.get('/api/ban', async (req, res) => {
    const result = {};
    for (const ban of banList) {
        result[ban] = await getBan(ban);
    }
    res.json(result);
});

// ================== API FULL BÀN ==================
app.get('/api/fullban', async (req, res) => {
    const danh_sach = {};
    for (const ban of banList) {
        danh_sach[ban] = await getBan(ban);
    }
    res.json({
        tong_ban: banList.length,
        danh_sach
    });
});

// ================== START ==================
app.listen(port, () => {
    console.log(`🚀 BCR API chạy tại port ${port}`);
});
