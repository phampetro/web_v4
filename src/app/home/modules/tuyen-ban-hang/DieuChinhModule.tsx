import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Spin, Tag, Select, Button, message, Checkbox, Typography, Tooltip, Modal } from 'antd';
import CustomTable from '../../../../components/CustomTable';
import { DownloadOutlined, ReloadOutlined, FormOutlined, CheckCircleOutlined, ClockCircleOutlined, SendOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { THU_OPTIONS, THU_LIST, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, TAN_SUAT_OPTIONS } from '../../../../constants';
import { useCachedData } from '../../../../hooks/useCachedData';

const { Text } = Typography;

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
    const { data, loading, reloadData, forceReload } = useCachedData<RecordType>({
        storeName: STORE_NAME,
        cacheKey: CACHE_KEY,
        apiPath: '/api/khach-hang/kpsds',
        ngayUpdate,
        setNgayUpdate
    });

    const [pendingStatus, setPendingStatus] = useState<Record<string, { status: string, nvbh: string, thu: string, ts: string }>>({});
    const [selectedKhuVuc, setSelectedKhuVuc] = useState<string | undefined>();
    const [actionLoading, setActionLoading] = useState(false);
    const [selectedNVBH, setSelectedNVBH] = useState<string | undefined>();
    const dayIdx = new Date().getDay(); // 0=CN, 1=T2...
    const todayThu = THU_LIST[(dayIdx + 6) % 7]; // Chuyển đổi để khớp với mảng T2 -> CN
    const [selectedThu, setSelectedThu] = useState<string | undefined>(todayThu);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [changes, setChanges] = useState<Record<string, Partial<RecordType>>>({});

    const [cachedKhuVuc, setCachedKhuVuc] = useState<string[]>([]);
    const [cachedNVBH, setCachedNVBH] = useState<{ MA_TEN_NVBH: string, TEN_KHUVUC: string }[]>([]);

    const fetchPendingStatus = useCallback(async () => {
        try {
            const { getCacheMeta } = await import('../../../../utils/indexedDB');
            let quyenQL = (await getCacheMeta('common_quyen_dl')) || '';
            if (!quyenQL) {
                const userInfoStr = localStorage.getItem('user_info');
                if (userInfoStr) {
                    const userInfo = JSON.parse(userInfoStr);
                    quyenQL = userInfo.quyenDL || '';
                }
            }
            const res = await fetch(`/api/khach-hang/chinh-tuyen?quyen_dl=${encodeURIComponent(quyenQL)}&_t=${Date.now()}`);
            const json = await res.json();
            if (json.data) {
                const map: Record<string, any> = {};
                json.data.forEach((item: any) => {
                    // Ưu tiên bản ghi mới nhất (vì đã ORDER BY DESC ở API)
                    if (!map[item.Ma_KH]) {
                        map[item.Ma_KH] = {
                            status: item.Trang_thai_duyet,
                            nvbh: item.Ma_ten_nvbh_MOI,
                            thu: item.Thu_MOI,
                            ts: item.Tan_suat_MOI
                        };
                    }
                });
                setPendingStatus(map);
            }
        } catch (e) {
            console.error('Fetch pending status error:', e);
        }
    }, []);

    useEffect(() => {
        fetchPendingStatus();
    }, [fetchPendingStatus]);

    const handleUpdate = (maKH: string, field: string, value: any, originalRecord: RecordType) => {
        if (field === 'Thứ' && (!value || value.length === 0)) return;

        setChanges(prev => {
            const currentChanges = { ...(prev[maKH] || {}), [field]: value };
            if (field === 'Thứ') {
                const days = value.split(',').filter(Boolean);
                const count = days.length;
                if (count >= 2) currentChanges['Tần_Suất'] = 'F8';
                else if (count === 1) currentChanges['Tần_Suất'] = 'F4';
            }

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

    useEffect(() => {
        const loadCache = async () => {
            try {
                const { getCacheMeta } = await import('../../../../utils/indexedDB');
                const kv = await getCacheMeta('common_khuvuc');
                const nv = await getCacheMeta('common_nvbh');

                if (kv) {
                    const kvData = JSON.parse(kv);
                    setCachedKhuVuc(kvData);
                    if (kvData.length > 0 && !selectedKhuVuc) setSelectedKhuVuc(kvData[0]);
                }

                if (nv) {
                    const nvData = JSON.parse(nv);
                    setCachedNVBH(nvData);
                    if (cachedKhuVuc[0] && !selectedNVBH) {
                        const firstNV = nvData.find((n: any) => n.TEN_KHUVUC === cachedKhuVuc[0]);
                        if (firstNV) setSelectedNVBH(firstNV.MA_TEN_NVBH);
                    }
                }
            } catch (e) {
                console.error('Load cache error:', e);
            }
        };
        loadCache();
    }, [cachedKhuVuc, selectedKhuVuc, selectedNVBH]);

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
                const dbStatus = pendingStatus[r.Mã_KH];
                if (dbStatus && dbStatus.status === 'Chờ duyệt') {
                    return (
                        <Tooltip title={`Chờ duyệt sang NVBH: ${dbStatus.nvbh}`}>
                            <Tag color="orange" icon={<ClockCircleOutlined />}>Chờ duyệt</Tag>
                        </Tooltip>
                    );
                }
                if (dbStatus && dbStatus.status === 'Đã duyệt') {
                    return (
                        <Tooltip title={`Vừa duyệt sang NVBH: ${dbStatus.nvbh}`}>
                            <Tag color="green" icon={<CheckCircleOutlined />}>Đã duyệt</Tag>
                        </Tooltip>
                    );
                }
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
                const dbStatus = pendingStatus[r.Mã_KH];
                if (dbStatus && dbStatus.status === 'Chờ duyệt') {
                    return (
                        <Tooltip title={`Chờ duyệt sang Thứ: ${dbStatus.thu}`}>
                            <Tag color="orange" icon={<ClockCircleOutlined />}>Chờ duyệt</Tag>
                        </Tooltip>
                    );
                }
                if (dbStatus && dbStatus.status === 'Đã duyệt') {
                    return (
                        <Tooltip title={`Vừa duyệt sang Thứ: ${dbStatus.thu}`}>
                            <Tag color="green" icon={<CheckCircleOutlined />}>Đã duyệt</Tag>
                        </Tooltip>
                    );
                }
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
                            if (newVals.length === 0) return;
                            let finalVals = newVals;
                            const oldVals = (rawVal as string).split(',').filter(Boolean);
                            if (rowChanges.Thứ === undefined && newVals.length === 2) {
                                const added = newVals.find(x => !oldVals.includes(x));
                                if (added) finalVals = [added];
                            } else {
                                finalVals = newVals.slice(0, 2);
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
                const dbStatus = pendingStatus[r.Mã_KH];
                if (dbStatus && dbStatus.status === 'Chờ duyệt') {
                    return (
                        <Tooltip title={`Chờ duyệt sang Tần suất: ${dbStatus.ts}`}>
                            <Tag color="orange" icon={<ClockCircleOutlined />}>Chờ duyệt</Tag>
                        </Tooltip>
                    );
                }
                if (dbStatus && dbStatus.status === 'Đã duyệt') {
                    return (
                        <Tooltip title={`Vừa duyệt sang Tần suất: ${dbStatus.ts}`}>
                            <Tag color="green" icon={<CheckCircleOutlined />}>Đã duyệt</Tag>
                        </Tooltip>
                    );
                }
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

    const handleReload = async () => {
        const res = await forceReload();
        if (res.updated) {
            message.success('Đã làm mới dữ liệu thành công!');
            await fetchPendingStatus();
        }
    };

    const handleSubmit = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('Hãy chọn khách hàng cần điều chỉnh tuyến');
            return;
        }

        const selectedRows = filteredData.filter(r => selectedRowKeys.includes(r.Mã_KH));
        const rowsToSend = selectedRows.map(r => {
            const change = changes[r.Mã_KH] || {};
            return {
                Khu_vuc: r.Khu_Vực,
                Ma_KH: r.Mã_KH,
                Ten_KH: r.Tên_KH,
                DC: r.Địa_Chỉ,
                Ma_ten_nvbh_CU: r.Mã_Tên_NVBH,
                Thu_CU: r.Thứ,
                Tan_suat_CU: r.Tần_Suất,
                Ma_ten_nvbh_MOI: change.Mã_Tên_NVBH || r.Mã_Tên_NVBH,
                Thu_MOI: change.Thứ !== undefined ? change.Thứ : r.Thứ,
                Tan_suat_MOI: change.Tần_Suất || r.Tần_Suất,
            };
        });

        Modal.confirm({
            title: 'Xác nhận gửi đăng ký',
            content: `Bạn đang gửi yêu cầu điều chỉnh cho ${rowsToSend.length} khách hàng.`,
            okText: 'Gửi ngay',
            cancelText: 'Hủy',
            onOk: async () => {
                setActionLoading(true);
                try {
                    let username = 'User';
                    const userInfoStr = localStorage.getItem('user_info');
                    if (userInfoStr) {
                        const userInfo = JSON.parse(userInfoStr);
                        username = userInfo.username || 'User';
                    }

                    const res = await fetch('/api/khach-hang/chinh-tuyen', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ rows: rowsToSend, nguoi_dang_ky: username }),
                    });

                    const json = await res.json();
                    if (json.success) {
                        message.success('Đã gửi yêu cầu đăng ký thành công!');
                        setChanges({});
                        setSelectedRowKeys([]);
                        await fetchPendingStatus();
                    } else {
                        message.error(json.error || 'Lỗi khi gửi yêu cầu');
                    }
                } catch (e) {
                    message.error('Lỗi kết nối server');
                } finally {
                    setActionLoading(false);
                }
            }
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'nowrap', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
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
                <div style={{ flex: 1 }}></div>
                <Button icon={<ReloadOutlined />} onClick={handleReload} loading={loading}>Tải lại</Button>
            </div>

            <Spin spinning={loading || actionLoading}>
                <CustomTable
                    columns={columns}
                    dataSource={filteredData}
                    rowKey="Mã_KH"
                    rowSelection={{
                        selectedRowKeys,
                        onChange: setSelectedRowKeys,
                        getCheckboxProps: (r) => ({
                            disabled: !!(pendingStatus[r.Mã_KH] && pendingStatus[r.Mã_KH].status === 'Chờ duyệt'),
                        }),
                    }}
                    onRow={(record) => ({
                        onClick: () => {
                            if (pendingStatus[record.Mã_KH]?.status === 'Chờ duyệt') return;
                        },
                        style: { cursor: (pendingStatus[record.Mã_KH]?.status === 'Chờ duyệt') ? 'default' : 'pointer' }
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

            <div style={{ marginTop: 12 }}>
                <Button
                    type="primary"
                    icon={<SendOutlined />}
                    disabled={selectedRowKeys.length === 0}
                    onClick={handleSubmit}
                    loading={actionLoading}
                    style={{ backgroundColor: selectedRowKeys.length > 0 ? '#722ed1' : undefined }}
                >
                    Gửi yêu cầu điều chỉnh {selectedRowKeys.length > 0 ? `(${selectedRowKeys.length})` : ''}
                </Button>
            </div>
        </div>
    );
}
