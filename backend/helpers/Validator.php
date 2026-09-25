<?php
class Validator {
    private array $errors = [];
    private array $data   = [];

    public function __construct(array $data) {
        $this->data = $data;
    }

    public function required(string $field, string $label = ''): self {
        $label = $label ?: ucfirst(str_replace('_', ' ', $field));
        if (!isset($this->data[$field]) || trim((string)$this->data[$field]) === '') {
            $this->errors[$field] = "$label is required.";
        }
        return $this;
    }

    public function email(string $field, string $label = ''): self {
        $label = $label ?: ucfirst(str_replace('_', ' ', $field));
        if (isset($this->data[$field]) && $this->data[$field] !== '' && !filter_var($this->data[$field], FILTER_VALIDATE_EMAIL)) {
            $this->errors[$field] = "$label must be a valid email address.";
        }
        return $this;
    }

    public function phone(string $field, string $label = ''): self {
        $label = $label ?: ucfirst(str_replace('_', ' ', $field));
        if (isset($this->data[$field]) && $this->data[$field] !== '') {
            $phone = preg_replace('/\D/', '', $this->data[$field]);
            if (strlen($phone) < 7 || strlen($phone) > 15) {
                $this->errors[$field] = "$label must be a valid phone number.";
            }
        }
        return $this;
    }

    public function minLength(string $field, int $min, string $label = ''): self {
        $label = $label ?: ucfirst(str_replace('_', ' ', $field));
        if (isset($this->data[$field]) && strlen(trim($this->data[$field])) < $min) {
            $this->errors[$field] = "$label must be at least $min characters.";
        }
        return $this;
    }

    public function maxLength(string $field, int $max, string $label = ''): self {
        $label = $label ?: ucfirst(str_replace('_', ' ', $field));
        if (isset($this->data[$field]) && strlen(trim($this->data[$field])) > $max) {
            $this->errors[$field] = "$label must not exceed $max characters.";
        }
        return $this;
    }

    public function passes(): bool {
        return empty($this->errors);
    }

    public function errors(): array {
        return $this->errors;
    }

    public function get(string $field, $default = null) {
        return isset($this->data[$field]) ? trim((string)$this->data[$field]) : $default;
    }

    public static function sanitizeString(string $value): string {
        return htmlspecialchars(strip_tags(trim($value)), ENT_QUOTES, 'UTF-8');
    }
}
