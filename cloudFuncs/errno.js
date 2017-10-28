// stolen from:
// linux/include/uapi/asm-generic/errno-base.h
// linux/incllude/uapi/asm-generic/errno.h

export const EPERM              =   -1;         /* Operation not permitted */
export const ENOENT             =   -2;         /* No such file or directory */
export const ESRCH              =   -3;         /* No such process */
export const EINTR              =   -4;         /* Interrupted system call */
export const EIO                =   -5;         /* I/O error */
export const ENXIO              =   -6;         /* No such device or address */
export const E2BIG              =   -7;         /* Argument list too long */
export const ENOEXEC            =   -8;         /* Exec format error */
export const EBADF              =   -9;         /* Bad file number */
export const ECHILD             =   -10;        /* No child processes */
export const EAGAIN             =   -11;        /* Try again */
export const ENOMEM             =   -12;        /* Out of memory */
export const EACCES             =   -13;        /* Permission denied */
export const EFAULT             =   -14;        /* Bad address */
export const ENOTBLK            =   -15;        /* Block device required */
export const EBUSY              =   -16;        /* Device or resource busy */
export const EEXIST             =   -17;        /* File exists */
export const EXDEV              =   -18;        /* Cross-device link */
export const ENODEV             =   -19;        /* No such device */
export const ENOTDIR            =   -20;        /* Not a directory */
export const EISDIR             =   -21;        /* Is a directory */
export const EINVAL             =   -22;        /* Invalid argument */
export const ENFILE             =   -23;        /* File table overflow */
export const EMFILE             =   -24;        /* Too many open files */
export const ENOTTY             =   -25;        /* Not a typewriter */
export const ETXTBSY            =   -26;        /* Text file busy */
export const EFBIG              =   -27;        /* File too large */
export const ENOSPC             =   -28;        /* No space left on device */
export const ESPIPE             =   -29;        /* Illegal seek */
export const EROFS              =   -30;        /* Read-only file system */
export const EMLINK             =   -31;        /* Too many links */
export const EPIPE              =   -32;        /* Broken pipe */
export const EDOM               =   -33;        /* Math argument out of domain of func */
export const ERANGE             =   -34;        /* Math result not representable */
export const EDEADLK            =   -35;        /* Resource deadlock would occur */
export const ENAMETOOLONG       =   -36;        /* File name too long */
export const ENOLCK             =   -37;        /* No record locks available */
export const ENOSYS             =   -38;        /* Invalid system call number */
export const ENOTEMPTY          =   -39;        /* Directory not empty */
export const ELOOP              =   -40;        /* Too many symbolic links encountered */
export const EWOULDBLOCK        =   EAGAIN;     /* Operation would block */
export const ENOMSG             =   -42;        /* No message of desired type */
export const EIDRM              =   -43;        /* Identifier removed */
export const ECHRNG             =   -44;        /* Channel number out of range */
export const EL2NSYNC           =   -45;        /* Level 2 not synchronized */
export const EL3HLT             =   -46;        /* Level 3 halted */
export const EL3RST             =   -47;        /* Level 3 reset */
export const ELNRNG             =   -48;        /* Link number out of range */
export const EUNATCH            =   -49;        /* Protocol driver not attached */
export const ENOCSI             =   -50;        /* No CSI structure available */
export const EL2HLT             =   -51;        /* Level 2 halted */
export const EBADE              =   -52;        /* Invalid exchange */
export const EBADR              =   -53;        /* Invalid request descriptor */
export const EXFULL             =   -54;        /* Exchange full */
export const ENOANO             =   -55;        /* No anode */
export const EBADRQC            =   -56;        /* Invalid request code */
export const EBADSLT            =   -57;        /* Invalid slot */
export const EDEADLOCK          =   EDEADLK;
export const EBFONT             =   -59;        /* Bad font file format */
export const ENOSTR             =   -60;        /* Device not a stream */
export const ENODATA            =   -61;        /* No data available */
export const ETIME              =   -62;        /* Timer expired */
export const ENOSR              =   -63;        /* Out of streams resources */
export const ENONET             =   -64;        /* Machine is not on the network */
export const ENOPKG             =   -65;        /* Package not installed */
export const EREMOTE            =   -66;        /* Object is remote */
export const ENOLINK            =   -67;        /* Link has been severed */
export const EADV               =   -68;        /* Advertise error */
export const ESRMNT             =   -69;        /* Srmount error */
export const ECOMM              =   -70;        /* Communication error on send */
export const EPROTO             =   -71;        /* Protocol error */
export const EMULTIHOP          =   -72;        /* Multihop attempted */
export const EDOTDOT            =   -73;        /* RFS specific error */
export const EBADMSG            =   -74;        /* Not a data message */
export const EOVERFLOW          =   -75;        /* Value too large for defined data type */
export const ENOTUNIQ           =   -76;        /* Name not unique on network */
export const EBADFD             =   -77;        /* File descriptor in bad state */
export const EREMCHG            =   -78;        /* Remote address changed */
export const ELIBACC            =   -79;        /* Can not access a needed shared library */
export const ELIBBAD            =   -80;        /* Accessing a corrupted shared library */
export const ELIBSCN            =   -81;        /* .lib section in a.out corrupted */
export const ELIBMAX            =   -82;        /* Attempting to link in too many shared libraries */
export const ELIBEXEC           =   -83;        /* Cannot exec a shared library directly */
export const EILSEQ             =   -84;        /* Illegal byte sequence */
export const ERESTART           =   -85;        /* Interrupted system call should be restarted */
export const ESTRPIPE           =   -86;        /* Streams pipe error */
export const EUSERS             =   -87;        /* Too many users */
export const ENOTSOCK           =   -88;        /* Socket operation on non-socket */
export const EDESTADDRREQ       =   -89;        /* Destination address required */
export const EMSGSIZE           =   -90;        /* Message too long */
export const EPROTOTYPE         =   -91;        /* Protocol wrong type for socket */
export const ENOPROTOOPT        =   -92;        /* Protocol not available */
export const EPROTONOSUPPORT    =   -93;        /* Protocol not supported */
export const ESOCKTNOSUPPORT    =   -94;        /* Socket type not supported */
export const EOPNOTSUPP         =   -95;        /* Operation not supported on transport endpoint */
export const EPFNOSUPPORT       =   -96;        /* Protocol family not supported */
export const EAFNOSUPPORT       =   -97;        /* Address family not supported by protocol */
export const EADDRINUSE         =   -98;        /* Address already in use */
export const EADDRNOTAVAIL      =   -99;        /* Cannot assign requested address */
export const ENETDOWN           =   -100;       /* Network is down */
export const ENETUNREACH        =   -101;       /* Network is unreachable */
export const ENETRESET          =   -102;       /* Network dropped connection because of reset */
export const ECONNABORTED       =   -103;       /* Software caused connection abort */
export const ECONNRESET         =   -104;       /* Connection reset by peer */
export const ENOBUFS            =   -105;       /* No buffer space available */
export const EISCONN            =   -106;       /* Transport endpoint is already connected */
export const ENOTCONN           =   -107;       /* Transport endpoint is not connected */
export const ESHUTDOWN          =   -108;       /* Cannot send after transport endpoint shutdown */
export const ETOOMANYREFS       =   -109;       /* Too many references: cannot splice */
export const ETIMEDOUT          =   -110;       /* Connection timed out */
export const ECONNREFUSED       =   -111;       /* Connection refused */
export const EHOSTDOWN          =   -112;       /* Host is down */
export const EHOSTUNREACH       =   -113;       /* No route to host */
export const EALREADY           =   -114;       /* Operation already in progress */
export const EINPROGRESS        =   -115;       /* Operation now in progress */
export const ESTALE             =   -116;       /* Stale file handle */
export const EUCLEAN            =   -117;       /* Structure needs cleaning */
export const ENOTNAM            =   -118;       /* Not a XENIX named type file */
export const ENAVAIL            =   -119;       /* No XENIX semaphores available */
export const EISNAM             =   -120;       /* Is a named type file */
export const EREMOTEIO          =   -121;       /* Remote I/O error */
export const EDQUOT             =   -122;       /* Quota exceeded */
export const ENOMEDIUM          =   -123;       /* No medium found */
export const EMEDIUMTYPE        =   -124;       /* Wrong medium type */
export const ECANCELED          =   -125;       /* Operation Canceled */
export const ENOKEY             =   -126;       /* Required key not available */
export const EKEYEXPIRED        =   -127;       /* Key has expired */
export const EKEYREVOKED        =   -128;       /* Key has been revoked */
export const EKEYREJECTED       =   -129;       /* Key was rejected by service */
export const EOWNERDEAD         =   -130;       /* Owner died */
export const ENOTRECOVERABLE    =   -131;       /* State not recoverable */
export const ERFKILL            =   -132;       /* Operation not possible due to RF-kill */
export const EHWPOISON          =   -133;       /* Memory page has hardware error */

export const ERROR_BASE               =   1000;
export const ERROR_BASE_AUTH          =   -(ERROR_BASE);
export const ERROR_BASE_DEVICE        =   -(ERROR_BASE + 1000);
export const ERROR_BASE_ORDER         =   -(ERROR_BASE + 2000);
export const ERROR_BASE_STATION       =   -(ERROR_BASE + 3000);
export const ERROR_BASE_ACCOUNT       =   -(ERROR_BASE + 4000);
export const ERROR_BASE_PROMOTION     =   -(ERROR_BASE + 5000);
export const ERROR_BASE_PROFIT        =   -(ERROR_BASE + 6000);
export const ERROR_BASE_DEAL          =   -(ERROR_BASE + 7000);

/* Auth */

/* Order */
export const ERROR_NO_ENOUGH_BALANCE        = (ERROR_BASE_ORDER - 1)        /* 用户钱包余额不足 */

/* Profit */
export const ERROR_IN_WITHDRAW_PROCESS      = (ERROR_BASE_PROFIT - 1)       /* 已经处于提现申请的状态中 */
export const ERROR_NOT_ENOUGH_MONEY         = (ERROR_BASE_PROFIT - 2)       /* 余额不足 */
export const ERROR_NOT_WITHDRAW_DATE        = (ERROR_BASE_PROFIT - 3)       /* 非取现日期 */

/* Promotion */
export const ERROR_PROM_REPEAT  = (ERROR_BASE_PROMOTION - 1)       /* 活动重复 */
export const ERROR_PROM_NOIP    = (ERROR_BASE_PROMOTION - 2)       /* 无法获取用户ip信息 */
export const ERROR_PROM_DISABLED= (ERROR_BASE_PROMOTION - 3)       /* 活动处于禁用状态 */
export const ERROR_PROM_TIME    = (ERROR_BASE_PROMOTION - 4)       /* 活动时间有误 */
export const ERROR_PROM_REGION  = (ERROR_BASE_PROMOTION - 5)       /* 活动范围有误 */
export const ERROR_PROM_INVALID = (ERROR_BASE_PROMOTION - 6)       /* 活动已失效 */
export const ERROR_PROM_LIMIT   = (ERROR_BASE_PROMOTION - 6)       /* 活动参与次数超限 */
export const ERROR_PROM_NOSCORE = (ERROR_BASE_PROMOTION - 7)       /* 积分不足 */

/* Deal */
export const ERROR_UNSUPPORT_CHANNEL        = (ERROR_BASE_DEAL - 1)         /* 不支持的支付渠道 */
export const ERROR_CREATE_TRANSFER          = (ERROR_BASE_DEAL - 2)         /* 创建交易请求失败 */
export const ERROR_NOT_MATCH_DEPOSIT        = (ERROR_BASE_DEAL - 3)         /* 提取押金的金额不匹配 */
export const ERROR_IN_REFUND_PROCESS        = (ERROR_BASE_DEAL - 4)         /* 已经处于提取押金的申请状态 */

/* Station */
export const ERROR_STATION_NOMAN = (ERROR_BASE_STATION - 1)       /* 查无此人 */
export const ERROR_STATION_HAVESTATION = (ERROR_BASE_STATION - 2)       /* 该用户仍和服务点有关联 */
