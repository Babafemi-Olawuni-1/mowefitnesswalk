<?php
class CSV {
    public static function download(array $data, array $headers, string $filename): void {
        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Pragma: no-cache');
        header('Expires: 0');
        $out = fopen('php://output', 'w');
        // BOM for Excel UTF-8 compatibility
        fputs($out, "\xEF\xBB\xBF");
        fputcsv($out, $headers, CSV_DELIMITER, CSV_ENCLOSURE);
        foreach ($data as $row) {
            fputcsv($out, $row, CSV_DELIMITER, CSV_ENCLOSURE);
        }
        fclose($out);
        exit;
    }
}
