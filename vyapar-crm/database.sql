-- Vyapar Database Schema
-- MySQL Database Setup

-- Create Database
CREATE DATABASE IF NOT EXISTS vyapar;
USE vyapar;

-- ==================== PRODUCTS TABLE ====================
CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    hsn VARCHAR(10) NOT NULL COMMENT '4-digit HSN code for GST',
    sku VARCHAR(50) NOT NULL UNIQUE COMMENT 'Stock Keeping Unit',
    purchase_price DECIMAL(10, 2) NOT NULL COMMENT 'Cost from supplier',
    selling_price DECIMAL(10, 2) NOT NULL COMMENT 'Price to customers',
    stock INT DEFAULT 0 COMMENT 'Current quantity in stock',
    category VARCHAR(100) DEFAULT 'General',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_hsn (hsn),
    INDEX idx_sku (sku),
    INDEX idx_stock (stock)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================== CUSTOMERS TABLE ====================
CREATE TABLE IF NOT EXISTS customers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(20) COMMENT 'Phone number',
    city VARCHAR(100) COMMENT 'City name',
    state VARCHAR(100) COMMENT 'Indian state',
    gstin VARCHAR(15) COMMENT 'Goods & Services Tax Identification Number',
    outstanding_balance DECIMAL(10, 2) DEFAULT 0 COMMENT 'Amount customer owes',
    total_purchased DECIMAL(10, 2) DEFAULT 0 COMMENT 'Lifetime purchase value',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_mobile (mobile),
    INDEX idx_state (state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================== INVOICES TABLE ====================
CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(50) PRIMARY KEY COMMENT 'Format: INV-2024-001',
    customer_id INT NOT NULL,
    customer_name VARCHAR(255),
    subtotal DECIMAL(10, 2) NOT NULL COMMENT 'Before tax',
    cgst DECIMAL(10, 2) DEFAULT 0 COMMENT 'Central GST (Intrastate)',
    sgst DECIMAL(10, 2) DEFAULT 0 COMMENT 'State GST (Intrastate)',
    igst DECIMAL(10, 2) DEFAULT 0 COMMENT 'Integrated GST (Interstate)',
    total DECIMAL(10, 2) NOT NULL COMMENT 'After tax',
    status VARCHAR(50) DEFAULT 'Pending' COMMENT 'Paid or Pending',
    tax_state VARCHAR(20) DEFAULT 'intrastate' COMMENT 'intrastate or interstate',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    INDEX idx_customer (customer_id),
    INDEX idx_status (status),
    INDEX idx_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================== INVOICE ITEMS TABLE ====================
CREATE TABLE IF NOT EXISTS invoice_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    invoice_id VARCHAR(50) NOT NULL,
    product_id INT NOT NULL,
    product_name VARCHAR(255),
    hsn VARCHAR(10) COMMENT 'HSN code at time of sale',
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL COMMENT 'Unit price at time of sale',
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_invoice (invoice_id),
    INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================== USERS TABLE (Optional - Multi-user) ====================
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user' COMMENT 'admin or user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================== SAMPLE DATA ====================

-- Insert sample products
INSERT INTO products (name, hsn, sku, purchase_price, selling_price, stock, category) VALUES
('Thermal Barcode Scanner', '8471', 'TBS-001', 4500, 6999, 12, 'Hardware'),
('Billing POS Printer', '8443', 'BPP-001', 8000, 12999, 3, 'Hardware'),
('Label Roll Pack (80mm x 40m)', '4821', 'LRP-001', 150, 249, 45, 'Consumables'),
('Cash Drawer', '8303', 'CD-001', 3500, 5499, 2, 'Hardware');

-- Insert sample customers
INSERT INTO customers (name, mobile, city, state, outstanding_balance, total_purchased) VALUES
('Rahul Gupta', '+91 98765 43210', 'Mumbai', 'Maharashtra', 5000, 25000),
('Anjali Paul', '+91 89765 43210', 'New Delhi', 'Delhi', 0, 18500),
('Vikram Sarin', '+91 79765 43210', 'Bengaluru', 'Karnataka', 12000, 45000);

-- Insert sample invoices
INSERT INTO invoices (id, customer_id, customer_name, subtotal, cgst, sgst, igst, total, status, tax_state) VALUES
('INV-2024-001', 1, 'Rahul Gupta', 6999, 630, 630, 0, 8259, 'Paid', 'intrastate'),
('INV-2024-002', 2, 'Anjali Paul', 2490, 224, 224, 0, 2938, 'Pending', 'intrastate');

-- Insert sample invoice items
INSERT INTO invoice_items (invoice_id, product_id, product_name, hsn, quantity, price) VALUES
('INV-2024-001', 1, 'Thermal Barcode Scanner', '8471', 1, 6999),
('INV-2024-002', 3, 'Label Roll Pack', '4821', 10, 249);

-- Insert sample user (for multi-user setup)
INSERT INTO users (username, password, email, role) VALUES
('admin', 'admin123', 'admin@vyapar.com', 'admin'),
('user1', 'user123', 'user1@vyapar.com', 'user');

-- ==================== VIEWS (Optional) ====================

-- View: Low Stock Items
CREATE OR REPLACE VIEW low_stock_items AS
SELECT id, name, sku, stock FROM products WHERE stock < 5;

-- View: Sales Summary
CREATE OR REPLACE VIEW sales_summary AS
SELECT 
    DATE(i.created_at) as date,
    COUNT(i.id) as invoice_count,
    SUM(i.total) as daily_revenue,
    SUM(i.cgst + i.sgst + i.igst) as gst_collected
FROM invoices i
GROUP BY DATE(i.created_at);

-- View: Customer Balances
CREATE OR REPLACE VIEW customer_balances AS
SELECT 
    c.id,
    c.name,
    c.state,
    c.outstanding_balance,
    c.total_purchased,
    COUNT(i.id) as invoice_count
FROM customers c
LEFT JOIN invoices i ON c.id = i.customer_id
GROUP BY c.id;

-- View: Top Products
CREATE OR REPLACE VIEW top_products AS
SELECT 
    ii.product_id,
    ii.product_name,
    ii.hsn,
    SUM(ii.quantity) as units_sold,
    SUM(ii.price * ii.quantity) as revenue
FROM invoice_items ii
GROUP BY ii.product_id
ORDER BY revenue DESC;

-- ==================== INDEXES FOR PERFORMANCE ====================

-- Already created in table definitions, but here are additional ones if needed:
-- ALTER TABLE invoices ADD INDEX idx_customer_status (customer_id, status);
-- ALTER TABLE invoice_items ADD INDEX idx_invoice_product (invoice_id, product_id);
-- ALTER TABLE customers ADD INDEX idx_outstanding (outstanding_balance);

-- ==================== STORED PROCEDURES (Optional) ====================

DELIMITER //

-- Generate Daily Summary Report
CREATE PROCEDURE IF NOT EXISTS sp_daily_summary(IN report_date DATE)
BEGIN
    SELECT 
        report_date as date,
        COUNT(DISTINCT i.id) as total_invoices,
        COUNT(DISTINCT i.customer_id) as unique_customers,
        SUM(i.total) as total_revenue,
        SUM(i.cgst + i.sgst + i.igst) as total_gst,
        SUM(CASE WHEN i.status = 'Paid' THEN i.total ELSE 0 END) as paid_revenue,
        SUM(CASE WHEN i.status = 'Pending' THEN i.total ELSE 0 END) as pending_revenue
    FROM invoices i
    WHERE DATE(i.created_at) = report_date;
END //

-- Get GST Collection Report
CREATE PROCEDURE IF NOT EXISTS sp_gst_report(IN start_date DATE, IN end_date DATE)
BEGIN
    SELECT 
        'CGST' as tax_type,
        SUM(cgst) as amount,
        COUNT(DISTINCT invoice_id) as invoice_count
    FROM invoices
    WHERE created_at BETWEEN start_date AND end_date AND cgst > 0
    UNION ALL
    SELECT 
        'SGST' as tax_type,
        SUM(sgst) as amount,
        COUNT(DISTINCT invoice_id) as invoice_count
    FROM invoices
    WHERE created_at BETWEEN start_date AND end_date AND sgst > 0
    UNION ALL
    SELECT 
        'IGST' as tax_type,
        SUM(igst) as amount,
        COUNT(DISTINCT invoice_id) as invoice_count
    FROM invoices
    WHERE created_at BETWEEN start_date AND end_date AND igst > 0;
END //

DELIMITER ;

-- ==================== BACKUP COMMANDS ====================

-- Backup database:
-- mysqldump -u root -p vyapar > vyapar_backup.sql

-- Restore database:
-- mysql -u root -p vyapar < vyapar_backup.sql

-- ==================== NOTES ====================

-- 1. Create database first: CREATE DATABASE vyapar;
-- 2. Run this script: mysql -u root -p vyapar < database.sql
-- 3. Verify tables: SHOW TABLES;
-- 4. Check data: SELECT * FROM products;

-- ==================== END OF SCHEMA ====================
