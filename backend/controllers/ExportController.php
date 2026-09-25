<?php
require_once __DIR__ . '/../models/Participant.php';
require_once __DIR__ . '/../models/Sponsor.php';
require_once __DIR__ . '/../models/Contact.php';
require_once __DIR__ . '/../models/Event.php';
require_once __DIR__ . '/../helpers/CSV.php';
require_once __DIR__ . '/../helpers/Response.php';

class ExportController {
    public function export(string $type): void {
        switch ($type) {
            case 'participants': $this->participants(); break;
            case 'sponsors':    $this->sponsors();    break;
            case 'contacts':    $this->contacts();    break;
            default: Response::notFound("Export type '$type' not found.");
        }
    }

    private function participants(): void {
        $rows = (new Participant())->getAll();
        $headers = ['ID','Participant ID','Full Name','Email','Phone','Status','Registered At'];
        $data = array_map(fn($r) => [
            $r['id'], $r['participant_id'], $r['full_name'], $r['email'],
            $r['phone'], $r['status'], $r['registered_at'],
        ], $rows);
        CSV::download($data, $headers, 'participants_' . date('Ymd_His') . '.csv');
    }

    private function sponsors(): void {
        $rows = (new Sponsor())->all();
        $headers = ['ID','Business Name','Website','WhatsApp','Priority','Status'];
        $data = array_map(fn($r) => [
            $r['id'], $r['business_name'], $r['website_url'] ?? '',
            $r['whatsapp'] ?? '', $r['priority'], $r['status'],
        ], $rows);
        CSV::download($data, $headers, 'sponsors_' . date('Ymd_His') . '.csv');
    }

    private function contacts(): void {
        $rows = (new Contact())->all();
        $headers = ['ID','Name','Email','Phone','Subject','Status','Date'];
        $data = array_map(fn($r) => [
            $r['id'], $r['name'], $r['email'], $r['phone'] ?? '',
            $r['subject'], $r['status'], $r['created_at'],
        ], $rows);
        CSV::download($data, $headers, 'contacts_' . date('Ymd_His') . '.csv');
    }
}
