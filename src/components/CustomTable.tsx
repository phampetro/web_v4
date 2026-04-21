import { Table, Typography } from 'antd';
import type { TableProps } from 'antd';

const { Text } = Typography;

interface CustomTableProps<RecordType> extends TableProps<RecordType> { }

function CustomTable<RecordType extends object = any>(props: CustomTableProps<RecordType>) {
  return (
    <>
      <Table
        {...props}
        className={`custom-table-compact ${props.className || ''}`}
        size={props.size || "small"}
        virtual={props.virtual !== undefined ? props.virtual : (typeof props.scroll?.y === 'number')}
        rowSelection={props.rowSelection ? {
          columnWidth: 40,
          ...props.rowSelection
        } : undefined}
        pagination={props.pagination === false ? false : {
          pageSize: 100,
          pageSizeOptions: [100, 500, 1000],
          showSizeChanger: true,
          ...props.pagination,
        }}
        scroll={{ y: 480, ...props.scroll }}


        rowClassName={(record, index, indent) => {
          let extraClass = '';
          if (typeof props.rowClassName === 'function') {
            extraClass = props.rowClassName(record, index, indent) || '';
          } else if (typeof props.rowClassName === 'string') {
            extraClass = props.rowClassName;
          }
          return `custom-table-row ${extraClass}`.trim();
        }}
        columns={props.columns?.map((col: any) => ({
          ...col,
          ellipsis: col.ellipsis !== false ? { tooltip: true } : false,
          align: (col.align || 'center') as 'left' | 'center' | 'right',
          render: col.render || ((v: any) => (
            <Text ellipsis={{ tooltip: true }} style={{ width: '100%', fontSize: 'inherit', color: 'inherit' }}>
              {v ?? ''}
            </Text>
          ))
        }))}
      />
      <style jsx global>{`
        .custom-table-compact .ant-table-tbody > tr > td {
          height: 32px !important;
          padding: 0 8px !important;
          font-size: 13px;
          white-space: nowrap !important;
          vertical-align: middle !important; /* Căn giữa theo chiều dọc */
        }
        .custom-table-compact .ant-table-thead > tr > th {
          height: 32px !important;
          padding: 0 8px !important;
          background-color: #fafafa !important;
          font-weight: 700 !important;
          vertical-align: middle !important;
          text-align: center !important;
        }
        .custom-table-row:hover td {
          background-color: #f0f7ff !important;
        }
        /* Triệt tiêu khe hở giữa header và body */
        .custom-table-compact .ant-table-header {
          margin-bottom: 0 !important;
        }
        .custom-table-compact .ant-table-body table {
          margin-top: 0 !important;
          border-top: none !important;
        }
        /* Ẩn hoàn toàn measure-row - nguyên nhân chính gây khoảng trống 1px */
        .custom-table-compact .ant-table-measure-row {
          visibility: collapse !important;
          line-height: 0 !important;
          height: 0 !important;
        }
        .custom-table-compact .ant-table-measure-row td {
          height: 0 !important;
          padding: 0 !important;
          border: none !important;
        }
        .custom-table-compact .ant-table-body {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
        /* Loại bỏ border-spacing nếu có */
        .custom-table-compact table {
          border-spacing: 0 !important;
          border-collapse: collapse !important;
        }
        .custom-table-compact .ant-table {
          margin: 0 !important;
        }
        /* Pagination Styling */
        .custom-table-compact .ant-table-pagination {
          display: flex !important;
          align-items: center !important;
          justify-content: flex-start !important;
          padding: 8px 16px !important;
          margin: 0 !important;
          border-top: 1px solid #d9d9d9 !important;
          background: #fafafa !important;
        }
        .custom-table-compact .ant-pagination-total-text {
          margin-left: auto !important;
          order: 99 !important;
          color: #8c8c8c;
          font-weight: 500;
          font-size: 13px;
        }
        .custom-table-compact .ant-pagination-item-active {
          background: #1677ff !important;
          border-color: #1677ff !important;
        }
        .custom-table-compact .ant-pagination-item-active a {
          color: #fff !important;
        }

        /* Tag Styling */
        .custom-table-compact .ant-tag {
          border-radius: 4px;
          padding: 0 8px;
          margin: 0;
        }

        /* Wrapper Styling */
        .custom-table-compact .ant-table-wrapper {
          border: 1px solid #d9d9d9;
          border-radius: 8px;
          overflow: hidden;
          background: #fff;
        }
      `}</style>
    </>
  );
}

export default CustomTable;
