<?php
session_start();

$conn = new mysqli('localhost', 'root', '', 'hotel_el_mehari');
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$user_id = isset($_SESSION['user_id']) ? $_SESSION['user_id'] : 1;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_SERVER['HTTP_X_REQUESTED_WITH'])) {
    header('Content-Type: application/json');
    
    $action = $_POST['action'] ?? '';
    
    if ($action === 'get_services') {
        $sql = "SELECT id, nom_service, type_service, prix, description, image, duree 
                FROM services WHERE disponibilite = 'disponible'";
        $result = $conn->query($sql);
        echo json_encode($result->fetch_all(MYSQLI_ASSOC));
        exit;
    }
    
    if ($action === 'get_bookings') {
        $sql = "SELECT r.*, s.nom_service, s.prix as service_price, s.image, s.duree
                FROM reservations r
                JOIN services s ON r.service_id = s.id
                WHERE r.client_id = ? AND r.type_reservation = 'service' AND r.statut != 'annulee'
                ORDER BY r.date_debut DESC";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        echo json_encode($stmt->get_result()->fetch_all(MYSQLI_ASSOC));
        exit;
    }
    
    if ($action === 'create_booking') {
        $service_id = $_POST['service_id'];
        $date_debut = $_POST['date_debut'];
        $date_fin = $_POST['date_fin'];
        $participants = $_POST['participants'];
        $priceSql = "SELECT prix, nom_service FROM services WHERE id = ?";
        $stmt = $conn->prepare($priceSql);
        $stmt->bind_param("i", $service_id);
        $stmt->execute();
        $service = $stmt->get_result()->fetch_assoc();
        
        $start = new DateTime($date_debut);
        $end = new DateTime($date_fin);
        $hours = ($end->getTimestamp() - $start->getTimestamp()) / 3600;
        $total = $service['prix'] * $hours * $participants;
        
        $sql = "INSERT INTO reservations (client_id, type_reservation, service_id, date_debut, date_fin, statut, montant_total, notes) 
                VALUES (?, 'service', ?, ?, ?, 'confirmee', ?, ?)";
        $stmt = $conn->prepare($sql);
        $notes = "Participants: " . $participants;
        $stmt->bind_param("iissss", $user_id, $service_id, $date_debut, $date_fin, $total, $notes);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'id' => $stmt->insert_id, 'total' => $total]);
        } else {
            echo json_encode(['success' => false, 'error' => $conn->error]);
        }
        exit;
    }
    
    if ($action === 'cancel_booking') {
        $booking_id = $_POST['booking_id'];
        $sql = "UPDATE reservations SET statut = 'annulee' 
                WHERE id = ? AND client_id = ? AND type_reservation = 'service'";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("ii", $booking_id, $user_id);
        echo json_encode(['success' => $stmt->execute()]);
        exit;
    }
}

$isLoggedIn = isset($_SESSION['user_id']) || true;
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mahari Hôtel — Services</title>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="services.css">
</head>
<body>
    <nav class="navbar">
        <a href="accueil.php" class="nav-logo">
            <div class="nav-logo-icon">M</div>
            <div>
                <div class="nav-logo-name">Mahari Hôtel</div>
                <div class="nav-logo-sub">Djerba · Tunisie</div>
            </div>
        </a>
        <ul class="nav-links">
            <li><a href="accueil.php">Accueil</a></li>
            <li><a href="reservation.php">Réservation</a></li>
            <li><a href="chambres.php">Chambres</a></li>
            <li class="active"><a href="services.php">Services</a></li>
            <li><a href="profil.php">Profil</a></li>
            <?php if (!$isLoggedIn): ?>
                <li><a href="login.php">Connexion</a></li>
            <?php else: ?>
                <li><a href="logout.php">Déconnexion</a></li>
            <?php endif; ?>
        </ul>
    </nav>

    <div class="hero">
        <div class="hero-overlay"></div>
        <div class="hero-content">
            <div class="hero-tag">Bien-être & Évasion</div>
            <h1>Services & <em>excellence</em></h1>
            <p>Réservez vos moments de détente et de plaisir gastronomique</p>
        </div>
    </div>

    <div class="filter-sticky">
        <div class="filter-inner">
            <span class="filter-label">Type</span>
            <button type="button" class="filter-btn active" data-filter="all">Tous</button>
            <button type="button" class="filter-btn" data-filter="spa">Spa</button>
            <button type="button" class="filter-btn" data-filter="restaurant">Restaurant</button>
            <button type="button" class="filter-btn" data-filter="piscine">Piscine</button>
            <button type="button" class="filter-btn" data-filter="excursion">Excursions</button>
        </div>
    </div>

    <div class="page-body">
        <div class="main-col">
            <p class="results-label"><strong id="catalogCount">0</strong> prestation(s) disponible(s)</p>
            <div id="services-catalog" class="services-catalog"></div>

            <section class="panel bookings-panel">
                <h2 class="section-heading">Mes réservations</h2>
                <div id="bookings-list" class="bookings-list"></div>
            </section>
        </div>

        <aside class="sidebar">
            <div class="panel form-panel">
                <h2 class="form-title">Réserver un service</h2>
                <form id="serviceReservationForm">
                    <div class="form-group">
                        <label class="form-label" for="serviceSelect">Prestation</label>
                        <select id="serviceSelect" class="form-control" required>
                            <option value="">Choisir une prestation...</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="dateService">Date</label>
                        <input type="date" id="dateService" class="form-control" required>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label" for="heureDebut">Heure début</label>
                            <input type="time" id="heureDebut" class="form-control" value="10:00" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="heureFin">Heure fin</label>
                            <input type="time" id="heureFin" class="form-control" value="12:00" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="participants">Nombre de personnes</label>
                        <input type="number" id="participants" class="form-control" min="1" max="20" value="1" required>
                    </div>

                    <div id="priceSummary" class="price-summary" style="display:none;">
                        <div class="price-row">
                            <span>Prestation</span>
                            <span id="summaryService">—</span>
                        </div>
                        <div class="price-row">
                            <span>Durée</span>
                            <span id="summaryDuration">—</span>
                        </div>
                        <div class="price-row">
                            <span>Participants</span>
                            <span id="summaryParticipants">—</span>
                        </div>
                        <div class="price-row price-row--total">
                            <span>Total</span>
                            <span id="summaryTotal" class="price-value">—</span>
                        </div>
                    </div>

                    <button type="submit" class="btn btn-primary btn-full">Réserver</button>
                </form>
            </div>
        </aside>
    </div>

    <footer class="site-footer">
        <strong>Mahari Hôtel</strong> · Services de luxe · © 2026
    </footer>

    <div id="toast" class="toast"></div>

    <script src="services.js"></script>
</body>
</html>
