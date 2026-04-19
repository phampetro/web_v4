import React, { useEffect, useState, useMemo } from 'react';
import { Spin, Tag, Select, Button, message, Checkbox, Typography, Tooltip, Modal, Table } from 'antd';
import CustomTable from '../../../../components/CustomTable';
import { DownloadOutlined, ReloadOutlined, FormOutlined, ArrowRightOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { THU_OPTIONS, THU_LIST, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, TAN_SUAT_OPTIONS } from '../../../../constants';
import { getStoreData } from '../../../../utils/indexedDB';
import { useCachedData } from '../../../../hooks/useCachedData';

const { Text, Title } = Typography;

interface RecordType {
    ID: number;
    Khu_Vực: string;
    Mã_Tên_NVBH: string;
    Mã_KH: string;
    Tên_KH: string;
    Địa_Chỉ: string;
    Thứ: string;
    Tần_Suất: string;
    [key: string]: any;
}

const STORE_NAME = 'kh_kpsds';
const CACHE_KEY = 'kh_kpsds_ngay_update';

export default function DieuChinhModule({ ngayUpdate, setNgayUpdate }: { ngayUpdate: string, setNgayUpdate?: (d: string) => void }) {
    const { data, loading, loadingText, reloadData, forceReload } = useCachedData<RecordType>({
        storeName: STORE_NAME,
        cacheKey: CACHE_KEY,
        apiPath: '/api/khach-hang/kpsds',
        ngayUpdate,
        setNgayUpdate
    });

    const [selectedKhuVuc, setSelectedKhuVuc] = useState<string | undefined>();
    const [actionLoading, setActionLoading] = useState(false);
    const [actionLoadingText, setActionLoadingText] = useState('');
    const [selectedNVBH, setSelectedNVBH] = useState<string | undefined>();
    const dayIdx = new Date().getDay(); // 0=CN, 1=T2...
    const todayThu = THU_LIST[(dayIdx + 6) % 7]; // Chuyển đổi để khớp với mảng T2 -> CN
    const [selectedThu, setSelectedThu] = useState<string | undefined>(todayThu);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [changes, setChanges] = useState<Record<string, Partial<RecordType>>>({});



    const handleUpdate = (maKH: string, field: string, value: any, originalRecord: RecordType) => {
        // Quy tắc: Thứ không được để trống
        if (field === 'Thứ' && (!value || value.length === 0)) return;

        setChanges(prev => {
            const currentChanges = { ...(prev[maKH] || {}), [field]: value };

            // Logic Tần suất tự động & Khóa
            if (field === 'Thứ') {
                const days = value.split(',').filter(Boolean);
                const count = days.length;
                if (count >= 2) currentChanges['Tần_Suất'] = 'F8';
                else if (count === 1) currentChanges['Tần_Suất'] = 'F4';
            }

            // Kiểm tra thực sự khác bản gốc
            const finalNVBH = currentChanges.Mã_Tên_NVBH || originalRecord.Mã_Tên_NVBH;
            const finalThu = currentChanges.Thứ !== undefined ? currentChanges.Thứ : originalRecord.Thứ;
            const finalTS = currentChanges.Tần_Suất || originalRecord.Tần_Suất;

            const isChanged =
                finalNVBH !== originalRecord.Mã_Tên_NVBH ||
                finalThu !== originalRecord.Thứ ||
                finalTS !== originalRecord.Tần_Suất;

            setSelectedRowKeys(prevKeys => {
                const exists = prevKeys.includes(maKH);
                if (isChanged && !exists) return [...prevKeys, maKH];
                if (!isChanged && exists) return prevKeys.filter(k => k !== maKH);
                return prevKeys;
            });

            if (!isChanged) {
                const newChanges = { ...prev };
                delete newChanges[maKH];
                return newChanges;
            }

            return { ...prev, [maKH]: currentChanges };
        });
    };

    const [cachedKhuVuc, setCachedKhuVuc] = useState<string[]>([]);
    const [cachedNVBH, setCachedNVBH] = useState<{ MA_TEN_NVBH: string, TEN_KHUVUC: string }[]>([]);

    // Load danh mục từ Cache
    useEffect(() => {
        const loadCache = async () => {
            try {
                const { getCacheMeta } = await import('../../../../utils/indexedDB');
                const kv = await getCacheMeta('common_khuvuc');
                const nv = await getCacheMeta('common_nvbh');

                let firstKV = '';
                if (kv) {
                    const kvData = JSON.parse(kv);
                    setCachedKhuVuc(kvData);
                    if (kvData.length > 0 && !selectedKhuVuc) {
                        firstKV = kvData[0];
                        setSelectedKhuVuc(firstKV);
                    }
                }

                if (nv) {
                    const nvData = JSON.parse(nv);
                    setCachedNVBH(nvData);
                    if (firstKV && !selectedNVBH) {
                        const firstNV = nvData.find((n: any) => n.TEN_KHUVUC === firstKV);
                        if (firstNV) setSelectedNVBH(firstNV.MA_TEN_NVBH);
                    }
                }
            } catch (e) {
                console.error('Load cache error:', e);
            }
        };
        loadCache();
    }, []);

    const filteredData = useMemo(() => {
        return data.filter(r => {
            if (selectedKhuVuc && r.Khu_Vực !== selectedKhuVuc) return false;
            if (selectedNVBH && r.Mã_Tên_NVBH !== selectedNVBH) return false;
            if (selectedThu && !r.Thứ.includes(selectedThu)) return false;
            return true;
        });
    }, [data, selectedKhuVuc, selectedNVBH, selectedThu]);

    const columns: ColumnsType<RecordType> = [
        { title: 'STT', key: 'stt', width: 45, align: 'center', render: (_, __, i) => i + 1 },
        {
            title: 'NVBH',
            dataIndex: 'Mã_Tên_NVBH',
            key: 'Mã_Tên_NVBH',
            width: 250,
            align: 'left',
            render: (v, r) => {
                const currentVal = changes[r.Mã_KH]?.Mã_Tên_NVBH || v;
                const options = cachedNVBH.filter(n => n.TEN_KHUVUC === r.Khu_Vực).map(n => ({ label: n.MA_TEN_NVBH, value: n.MA_TEN_NVBH }));
                return (
                    <Select
                        variant="borderless"
                        style={{ width: '100%', padding: 0 }}
                        value={currentVal}
                        onChange={(val) => handleUpdate(r.Mã_KH, 'Mã_Tên_NVBH', val, r)}
                        showSearch
                        options={options}
                        status={changes[r.Mã_KH]?.Mã_Tên_NVBH ? 'warning' : ''}
                        popupMatchSelectWidth={false}
                    />
                );
            }
        },
        {
            title: 'Khách hàng',
            key: 'khach_hang',
            width: 210,
            align: 'left',
            render: (_, r) => (
                <Tooltip title={`${r.Mã_KH} - ${r.Tên_KH}`} mouseEnterDelay={0.5}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <Text strong style={{ color: '#1677ff', fontSize: 13, marginRight: 4 }}>{r.Mã_KH}</Text>
                        <Text style={{ fontSize: 13 }}> - {r.Tên_KH}</Text>
                    </div>
                </Tooltip>
            )
        },
        { title: 'Địa chỉ', dataIndex: 'Địa_Chỉ', key: 'Địa_Chỉ', width: 250, align: 'left' },
        {
            title: 'Thứ',
            dataIndex: 'Thứ',
            key: 'Thứ',
            width: 180,
            align: 'center',
            render: (v, r) => {
                const rowChanges = changes[r.Mã_KH] || {};
                const rawVal = rowChanges.Thứ !== undefined ? rowChanges.Thứ : (v || '');
                const currentVal = (rawVal as string).split(',').filter(Boolean);
                return (
                    <Select
                        mode="multiple"
                        variant="borderless"
                        style={{ width: '100%' }}
                        value={currentVal}
                        onChange={(newVals) => {
                            if (newVals.length === 0) return; // Không cho phép để trống

                            let finalVals = newVals;
                            const oldVals = (rawVal as string).split(',').filter(Boolean);

                            // Logic: Lần đầu sẽ thay đổi (Replace)
                            if (rowChanges.Thứ === undefined && newVals.length === 2) {
                                const added = newVals.find(x => !oldVals.includes(x));
                                if (added) finalVals = [added];
                            } else {
                                finalVals = newVals.slice(0, 2); // Tối đa 2
                            }

                            handleUpdate(r.Mã_KH, 'Thứ', finalVals.join(','), r);
                        }}
                        options={THU_OPTIONS}
                        maxCount={2}
                        maxTagCount="responsive"
                        status={rowChanges.Thứ ? 'warning' : ''}
                    />
                );
            }
        },
        {
            title: 'Tần suất',
            dataIndex: 'Tần_Suất',
            key: 'Tần_Suất',
            width: 120,
            align: 'center',
            render: (v, r) => {
                const rowChanges = changes[r.Mã_KH] || {};
                const currentVal = rowChanges.Tần_Suất || v;
                const thuCount = (rowChanges.Thứ !== undefined ? rowChanges.Thứ : (v || r.Thứ || '')).split(',').filter(Boolean).length;

                return (
                    <Select
                        variant="borderless"
                        style={{ width: '100%' }}
                        value={currentVal}
                        onChange={(val) => handleUpdate(r.Mã_KH, 'Tần_Suất', val, r)}
                        options={thuCount < 2 ? TAN_SUAT_OPTIONS.filter(o => o.value !== 'F8') : TAN_SUAT_OPTIONS}
                        status={rowChanges.Tần_Suất ? 'warning' : ''}
                        disabled={thuCount >= 2}
                    />
                );
            }
        },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Filter Section */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'nowrap', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ flex: 1, maxWidth: 250 }}>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Khu vực</div>
                    <Select
                        placeholder="Tất cả"
                        value={selectedKhuVuc}
                        onChange={v => { setSelectedKhuVuc(v); setSelectedNVBH(undefined); }}
                        allowClear showSearch
                        options={cachedKhuVuc.map(v => ({ label: v, value: v }))}
                        style={{ width: '100%' }}
                    />
                </div>
                <div style={{ flex: 1, maxWidth: 270 }}>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>NVBH</div>
                    <Select
                        placeholder="Tất cả"
                        value={selectedNVBH}
                        onChange={setSelectedNVBH}
                        allowClear showSearch
                        options={cachedNVBH.filter(n => !selectedKhuVuc || n.TEN_KHUVUC === selectedKhuVuc).map(n => ({ label: n.MA_TEN_NVBH, value: n.MA_TEN_NVBH }))}
                        style={{ width: '100%' }}
                    />
                </div>

                <div style={{ width: 100 }}>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Thứ</div>
                    <Select
                        placeholder="Tất cả"
                        value={selectedThu}
                        onChange={setSelectedThu}
                        allowClear
                        options={THU_OPTIONS}
                        style={{ width: '100%' }}
                    />
                </div>

                <div style={{ flex: 1.2 }}></div>
            </div>

            <Spin spinning={loading || actionLoading} description={loadingText || actionLoadingText}>
                <CustomTable
                    columns={columns}
                    dataSource={filteredData}
                    rowKey="Mã_KH"
                    rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
                    onRow={(record) => ({
                        onClick: (e) => {
                            // Ngăn chặn việc xử lý nếu click vào các phần tử điều khiển (checkbox, select, v.v.)
                            const target = e.target as HTMLElement;
                            if (target.closest('.ant-table-selection-column') || target.closest('.ant-select') || target.closest('.ant-checkbox-wrapper')) {
                                return;
                            }

                            const key = record.Mã_KH;
                            setSelectedRowKeys(prev => {
                                const exists = prev.includes(key);
                                if (exists) return prev.filter(k => k !== key);
                                return [...prev, key];
                            });
                        },
                        style: { cursor: 'pointer' }
                    })}
                    pagination={{
                        pageSize,
                        onChange: (_, size) => setPageSize(size),
                        showSizeChanger: true,
                        pageSizeOptions: PAGE_SIZE_OPTIONS,
                        showTotal: (total, range) => <span>{range[0]}-{range[1]} / {total} — Đang hiện: <b>{filteredData.length}</b> dòng</span>
                    }}
                />
            </Spin>

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <Button icon={<ReloadOutlined />} onClick={forceReload} loading={loading}>Tải lại</Button>
                <Button
                    icon={<FormOutlined />}
                    style={selectedRowKeys.length > 0 ? { color: '#faad14', borderColor: '#faad14' } : {}}
                    onClick={async () => {
                        if (selectedRowKeys.length === 0) {
                            message.warning('Hãy Tick chọn khách hàng cần điều chỉnh tuyến');
                            return;
                        }

                        setActionLoading(true);
                        setActionLoadingText('Đang kiểm tra dữ liệu...');

                        try {
                            // Tải danh sách đơn chờ duyệt để đối soát
                            const resPending = await fetch('/api/khach-hang/chinh-tuyen/check', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ maKHs: selectedRowKeys })
                            });
                            const pendingList = await resPending.json();

                            if (!Array.isArray(pendingList)) {
                                message.error('Không thể kiểm tra trạng thái đơn cũ');
                                setActionLoading(false);
                                setActionLoadingText('');
                                return;
                            }

                            const rowsSummary = selectedRowKeys.map(maKH => {
                                const r = data.find(x => x.Mã_KH === maKH);
                                if (!r) return null;
                                const change = changes[maKH as string] || {};
                                const isPending = pendingList.some(p => p.Ma_KH === maKH && p.Trang_thai_duyet === 'Chờ duyệt');

                                return {
                                    maKH: r.Mã_KH,
                                    tenKH: r.Tên_KH,
                                    tinhTrang: isPending ? 'Cập nhật' : 'Đăng ký mới',
                                    nvbhMoi: change.Mã_Tên_NVBH || r.Mã_Tên_NVBH,
                                    thuMoi: change.Thứ !== undefined ? change.Thứ : r.Thứ,
                                    tsMoi: change.Tần_Suất || r.Tần_Suất,
                                    original: r,
                                    change: change
                                };
                            }).filter((x): x is any => x !== null);

                            setActionLoading(false);
                            setActionLoadingText('');

                            Modal.confirm({
                                title: 'Xác nhận gửi đăng ký điều chỉnh',
                                width: 500,
                                content: (
                                    <div style={{ marginTop: 16, maxHeight: 400, overflowY: 'auto' }}>
                                        <div style={{ marginBottom: 12 }}>Bạn đang thực hiện đăng ký cho <b>{rowsSummary.length}</b> khách hàng sau:</div>
                                        {rowsSummary.map((r: any) => (
                                            <div key={r.maKH} style={{ marginBottom: 6, fontSize: 13, display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', paddingBottom: 4 }}>
                                                <span><b>{r.maKH}</b> - {r.tenKH}</span>
                                                <Tag color={r.tinhTrang.includes('Cập nhật') ? 'orange' : 'green'} variant="filled" style={{ fontSize: 11 }}>{r.tinhTrang}</Tag>
                                            </div>
                                        ))}
                                    </div>
                                ),
                                okText: 'Xác nhận gửi',
                                cancelText: 'Hủy',
                                onOk: async () => {
                                    setActionLoading(true);
                                    setActionLoadingText('Đang gửi đăng ký...');
                                    try {
                                        let username = 'Admin';
                                        const userInfoStr = localStorage.getItem('user_info');
                                        if (userInfoStr) {
                                            const userInfo = JSON.parse(userInfoStr);
                                            username = userInfo.username || 'Admin';
                                        }

                                        const rowsToSend = rowsSummary.map((r: any) => ({
                                            Khu_vuc: r.original.Khu_Vực,
                                            Ma_KH: r.maKH,
                                            Ten_KH: r.tenKH,
                                            DC: r.original.Địa_Chỉ,
                                            Ma_ten_nvbh_CU: r.original.Mã_Tên_NVBH,
                                            Thu_CU: r.original.Thứ,
                                            Tan_suat_CU: r.original.Tần_Suất,
                                            Ma_ten_nvbh_MOI: r.nvbhMoi,
                                            Thu_MOI: r.thuMoi,
                                            Tan_suat_MOI: r.tsMoi,
                                        }));

                                        const res = await fetch('/api/khach-hang/chinh-tuyen', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ rows: rowsToSend, nguoi_dang_ky: username }),
                                        });

                                        const json = await res.json();
                                        if (json.success) {
                                            message.success('Đã gửi yêu cầu đăng ký điều chỉnh tuyến');
                                            setChanges({});
                                            setSelectedRowKeys([]);
                                        } else {
                                            message.error(json.error || 'Lỗi khi gửi đăng ký');
                                        }
                                    } catch (e) {
                                        console.error('Submit error:', e);
                                        message.error('Lỗi kết nối Server');
                                    } finally {
                                        setActionLoading(false);
                                        setActionLoadingText('');
                                    }
                                }
                            });
                        } catch (e) {
                            console.error('Check error:', e);
                            message.error('Lỗi khi kiểm tra dữ liệu cũ');
                            setActionLoading(false);
                            setActionLoadingText('');
                        }
                    }}
                >
                    Đăng ký điều chỉnh ({selectedRowKeys.length})
                </Button>

            </div>
        </div>
    );
}
